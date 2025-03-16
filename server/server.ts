import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

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

// const REMOTIVE_API_URL = "https://remotive.io/api/remote-jobs?category=software-dev";
const REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs?search=front%20end";

// Function to fetch job postings from Remotive API
const fetchJobPostsFromRemotive = async () => {
  try {
    console.log("🔍 Fetching job posts from Remotive API...");

    const response = await axios.get(REMOTIVE_API_URL);
    const jobs = response.data.jobs || [];

    const jobPosts = jobs.map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location,
      url: job.url,
      date: job.publication_date,
    }));

    // Sort job posts by publication date in descending order
    jobPosts.sort(
      (a: { date: string }, b: { date: string }) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    console.log("Fetched job posts:", jobPosts); // Log the fetched job posts
    return jobPosts;
  } catch (error) {
    console.error(
      "❌ Error fetching job posts from Remotive:",
      (error as Error).message
    );
    return [];
  }
};

// Function to update cache
const updateCache = async () => {
  console.log("🔄 Refreshing cached job posts...");
  try {
    const jobPosts = await fetchJobPostsFromRemotive();
    cachedData = jobPosts;
    lastUpdated = Date.now();
    console.log("✅ Cache updated successfully!");
    console.log("Cached job posts:", cachedData); // Log the cached job posts
  } catch (error) {
    console.error("❌ Error updating cache:", (error as Error).message);
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


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  updateCache();
});
