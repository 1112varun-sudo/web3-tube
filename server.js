require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const PORT = Number(process.env.PORT || 4000);
const MONGODB_URI = process.env.MONGODB_URI || "";
const hasRealMongoUri =
  MONGODB_URI &&
  !MONGODB_URI.includes("your_mongodb_atlas_connection_string") &&
  !MONGODB_URI.includes("USERNAME:PASSWORD");
let runtimeMode = hasRealMongoUri ? "mongodb" : "memory-demo";

const videoSchema = new mongoose.Schema(
  {
    contractVideoId: {
      type: Number,
      unique: true,
      sparse: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    hash: {
      type: String,
      required: true,
      trim: true
    },
    thumbnailUrl: {
      type: String,
      default: ""
    },
    category: {
      type: String,
      default: "Education"
    },
    author: {
      type: String,
      default: ""
    },
    createdAt: {
      type: Number,
      default: () => Math.floor(Date.now() / 1000)
    },
    source: {
      type: String,
      default: "blockchain"
    }
  },
  {
    versionKey: false,
    timestamps: true
  }
);

const Video = mongoose.model("Video", videoSchema);
const memoryVideos = [];

function createApp() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(200).json({ ok: true });
      return;
    }

    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      database: runtimeMode,
      connected: runtimeMode === "mongodb" ? mongoose.connection.readyState === 1 : true,
      databaseName: runtimeMode === "mongodb" ? mongoose.connection.name || "" : "demo-memory"
    });
  });

  app.get("/api/videos", async (req, res) => {
    const videos = runtimeMode === "mongodb"
      ? await Video.find({})
          .sort({ contractVideoId: -1, createdAt: -1, _id: -1 })
          .lean()
      : [...memoryVideos].sort((first, second) => {
          const firstId = first.contractVideoId ?? 0;
          const secondId = second.contractVideoId ?? 0;

          if (secondId !== firstId) {
            return secondId - firstId;
          }

          return (second.createdAt ?? 0) - (first.createdAt ?? 0);
        });

    res.json({ videos });
  });

  app.get("/api/videos/export", async (req, res) => {
    const videos = runtimeMode === "mongodb"
      ? await Video.find({})
          .sort({ createdAt: 1, _id: 1 })
          .lean()
      : [...memoryVideos].sort((first, second) => (first.createdAt ?? 0) - (second.createdAt ?? 0));

    res.json({
      ok: true,
      count: videos.length,
      videos: videos.map((video) => ({
        title: video.title,
        hash: video.hash,
        thumbnailUrl: video.thumbnailUrl || "",
        category: video.category || "Education",
        author: video.author || "",
        createdAt: video.createdAt ?? Math.floor(Date.now() / 1000)
      }))
    });
  });

  app.get("/api/stats", async (req, res) => {
    const totalVideos = runtimeMode === "mongodb" ? await Video.countDocuments() : memoryVideos.length;
    res.json({ total_videos: totalVideos });
  });

  app.post("/api/videos", async (req, res) => {
    const payload = req.body || {};

    if (!payload.title || !payload.hash) {
      res.status(400).json({ error: "title and hash are required" });
      return;
    }

    let video;

    if (runtimeMode === "mongodb") {
      const filter =
        payload.contractVideoId === undefined || payload.contractVideoId === null
          ? { hash: payload.hash, author: payload.author ?? "" }
          : { contractVideoId: payload.contractVideoId };

      video = await Video.findOneAndUpdate(
        filter,
        {
          $set: {
            contractVideoId: payload.contractVideoId ?? null,
            title: payload.title,
            hash: payload.hash,
            thumbnailUrl: payload.thumbnailUrl ?? "",
            category: payload.category ?? "Education",
            author: payload.author ?? "",
            createdAt: payload.createdAt ?? Math.floor(Date.now() / 1000),
            source: payload.source ?? "blockchain"
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      ).lean();
    } else {
      const existingIndex = memoryVideos.findIndex((item) => {
        if (payload.contractVideoId !== undefined && payload.contractVideoId !== null) {
          return item.contractVideoId === payload.contractVideoId;
        }

        return item.hash === payload.hash && item.author === (payload.author ?? "");
      });

      video = {
        contractVideoId: payload.contractVideoId ?? null,
        title: payload.title,
        hash: payload.hash,
        thumbnailUrl: payload.thumbnailUrl ?? "",
        category: payload.category ?? "Education",
        author: payload.author ?? "",
        createdAt: payload.createdAt ?? Math.floor(Date.now() / 1000),
        source: payload.source ?? "blockchain"
      };

      if (existingIndex >= 0) {
        memoryVideos[existingIndex] = {
          ...memoryVideos[existingIndex],
          ...video
        };
        video = memoryVideos[existingIndex];
      } else {
        memoryVideos.push(video);
      }
    }

    res.status(201).json({ ok: true, video });
  });

  app.delete("/api/videos/:videoId", async (req, res) => {
    const requestedId = Number(req.params.videoId);
    const requestedHash = req.query.hash || "";

    if (runtimeMode === "mongodb") {
      const filter = Number.isFinite(requestedId) && requestedId > 0
        ? { contractVideoId: requestedId }
        : { hash: requestedHash };

      await Video.deleteMany(filter);
    } else {
      const nextVideos = memoryVideos.filter((video) => {
        if (Number.isFinite(requestedId) && requestedId > 0) {
          return video.contractVideoId !== requestedId;
        }

        return video.hash !== requestedHash;
      });

      memoryVideos.length = 0;
      memoryVideos.push(...nextVideos);
    }

    res.json({ ok: true });
  });

  app.use((error, req, res, next) => {
    res.status(500).json({
      error: "server error",
      details: error.message
    });
  });

  return app;
}

async function start() {
  if (hasRealMongoUri) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
      });
    } catch (error) {
      runtimeMode = "memory-demo";
      console.warn(`MongoDB connect failed, switching to demo memory mode: ${error.message}`);
    }
  }

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Database API running at http://localhost:${PORT}`);

    if (runtimeMode === "mongodb") {
      console.log(`MongoDB database connected: ${mongoose.connection.name}`);
    } else {
      console.log("MongoDB URI not set yet. Running in demo memory mode.");
      console.log("Add a real MONGODB_URI in .env to switch to MongoDB Atlas.");
    }
  });
}
start().catch((error) => {
  console.error("Failed to start database API:", error.message);
  process.exit(1);
});
