import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;
app.use(cors());

let cachedData: {
  title: string;
  company: string;
  location: string;
  url: string;
  date: string;
}[] = [];
let lastUpdated = 0;

const CACHE_FILE = "./cache.json"; // File to store cached job posts
const JSEARCH_API_URL = "https://jsearch.p.rapidapi.com/search";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = "jsearch.p.rapidapi.com";

interface Job {
  job_title: string;
  employer_name: string;
  job_city?: string;
  job_state?: string;
  job_apply_link: string;
  job_posted_at_datetime_utc: string;
}

// Function to load cache from file
const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (data.jobPosts && data.lastUpdated) {
        cachedData = data.jobPosts;
        lastUpdated = data.lastUpdated;
        console.log("✅ Cache loaded from file.",cachedData);
      }
    }
  } catch (error) {
    console.error("❌ Error loading cache:", error);
  }
};

// Function to save cache to file
const saveCache = () => {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify({ jobPosts: cachedData, lastUpdated }, null, 2)
    );
    console.log("✅ Cache saved to file.");
  } catch (error) {
    console.error("❌ Error saving cache:", error);
  }
};

// Function to fetch job postings from JSearch API
const fetchJobPostsFromJSearch = async (query: string) => {
  try {
    console.log(`🔍 Fetching job posts from JSearch API with query: ${query}...`);

    const response = await axios.get(JSEARCH_API_URL, {
      headers: {
        "X-RapidAPI-Key": RAPIDAPI_KEY!,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
      params: {
        query,
        page: "1",
        num_pages: "1",
      },
    });

    const jobs: Job[] = response.data.data || [];

    return jobs
      .map((job: Job) => ({
        title: job.job_title,
        company: job.employer_name,
        location: job.job_city || job.job_state || "Remote",
        url: job.job_apply_link,
        date: job.job_posted_at_datetime_utc,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error(
      "❌ Error fetching job posts from JSearch:",
      (error as Error).message
    );
    return [];
  }
};

// Function to update cache
const updateCache = async () => {
  console.log("🔄 Refreshing cached job posts...");
  try {
    const jobPosts = await fetchJobPostsFromJSearch(
      "Frontend Developer OR FullStack Developer"
    );

    // Sort all jobs by date (latest first)
    const allPosts = jobPosts.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    cachedData = allPosts;
    lastUpdated = Date.now();

    saveCache();
    console.log(`✅ Cache updated with ${cachedData.length} jobs!`,cachedData);
  } catch (error) {
    console.error("❌ Error updating cache:", error);
  }
};



// API to get job posts (fetch from cache or update if outdated)
app.get("/scrape-job-posts", async (_, res) => {
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  if (Date.now() - lastUpdated > TWO_HOURS || cachedData.length === 0) {
    console.log("⏳ Cache expired. Fetching new data...");
    await updateCache();
  } else {
    console.log("✅ Serving cached data...");
  }

  res.json({
    success: true,
    lastUpdated: new Date(lastUpdated),
    jobPosts: cachedData,
  });
});

// API to manually refresh cache
app.get("/refresh-cache", async (_, res) => {
  console.log("🔄 Manual cache refresh requested...");
  await updateCache();
  res.json({ success: true, message: "Cache refreshed successfully!" });
});

// Load cache on server start
loadCache();

// Start the server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  // Only update cache if there is no valid cached data
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  if (Date.now() - lastUpdated > TWO_HOURS || cachedData.length === 0) {
    console.log("⏳ No valid cache found. Fetching new data...");
    await updateCache();
  } else {
    console.log("✅ Using existing cached data.");
  }
});
