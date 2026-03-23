import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import "./App.css";
import deployment from "./contract-address.json";

const contractAddress = deployment.address;
const abi = [
  "function videoCount() public view returns(uint256)",
  "function videos(uint256) public view returns(uint256,string,string,address,uint256,uint256,uint256,uint256)",
  "function uploadVideo(string memory _hash, string memory _title) public",
  "function viewVideo(uint256 _id) public",
  "function toggleLike(uint256 _id) public",
  "function addComment(uint256 _id, string memory _text) public",
  "function getComment(uint256 _videoId, uint256 _commentId) public view returns(address,string,uint256)",
  "function hasLiked(uint256,address) public view returns(bool)"
];

const pages = ["Home", "Watch", "Channel", "Library", "Playlists"];
const categories = ["All", "Trending", "Coding", "Music", "Gaming", "Education", "Blockchain", "Other"];
const uploadCategories = categories.filter((category) => !["All", "Trending"].includes(category));
const sortOptions = ["Latest", "Most Viewed", "Most Liked", "Most Discussed"];
const databaseApiBase = "http://localhost:4000/api";
const demoVideos = [
  {
    id: 1,
    hash: "demo-local-1",
    thumbnailUrl: "https://images.unsplash.com/photo-1494253109108-2e30c049369b?auto=format&fit=crop&w=1200&q=80",
    title: "Founders Day Launch Reel",
    author: "0xDemo000000000000000000000000000000000001",
    createdAt: 1710000000,
    views: 128,
    likes: 32,
    commentCount: 2,
    likedByWallet: false
  },
  {
    id: 2,
    hash: "demo-local-2",
    thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    title: "Campus Product Showcase",
    author: "0xDemo000000000000000000000000000000000002",
    createdAt: 1710003600,
    views: 214,
    likes: 54,
    commentCount: 4,
    likedByWallet: false
  },
  {
    id: 3,
    hash: "demo-local-3",
    thumbnailUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
    title: "Creator Demo Walkthrough",
    author: "0xDemo000000000000000000000000000000000003",
    createdAt: 1710007200,
    views: 301,
    likes: 77,
    commentCount: 6,
    likedByWallet: false
  }
];

const fallbackThumbnailsByCategory = {
  Coding: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
  Music: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
  Gaming: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
  Education: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80",
  Blockchain: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80",
  Other: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80"
};

function getDemoVideoByHash(hash) {
  return demoVideos.find((video) => video.hash === hash) || null;
}

function getResolvedThumbnail(video) {
  const demoThumbnail = getDemoVideoByHash(video.hash)?.thumbnailUrl;
  const categoryFallback = fallbackThumbnailsByCategory[getCategory(video)] || fallbackThumbnailsByCategory.Education;

  return video.thumbnailUrl || demoThumbnail || categoryFallback;
}

function resolveSelectedVideoId(videos, preferredId) {
  if (!videos.length) {
    return null;
  }

  if (preferredId && videos.some((video) => video.id === preferredId)) {
    return preferredId;
  }

  return videos[0].id;
}

function formatAddress(value) {
  if (!value) {
    return "Not connected";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeIpfsHash(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("/ipfs/")) {
    return trimmed.split("/ipfs/")[1].split("?")[0];
  }

  if (trimmed.startsWith("ipfs://")) {
    return trimmed.replace("ipfs://", "").split("?")[0];
  }

  return trimmed;
}

function getVideoGatewayUrls(hash) {
  if (!hash) {
    return [];
  }

  if (hash.startsWith("http://") || hash.startsWith("https://")) {
    return [hash];
  }

  if (hash.startsWith("demo-local-")) {
    return ["/demo-video.mp4"];
  }

  const normalizedHash = normalizeIpfsHash(hash);

  return [
    `https://ipfs.io/ipfs/${normalizedHash}`,
    `https://gateway.pinata.cloud/ipfs/${normalizedHash}`,
    `https://cloudflare-ipfs.com/ipfs/${normalizedHash}`,
    "/demo-video.mp4"
  ];
}

function getVideoUrl(hash) {
  return getVideoGatewayUrls(hash)[0] || "/demo-video.mp4";
}

async function generateThumbnailFromFile(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const thumbnail = await new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");

      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;

      video.onloadeddata = () => {
        const captureTime = Math.min(1, Math.max(0, (video.duration || 0) / 3));
        video.currentTime = captureTime;
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas not supported"));
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      video.onerror = () => reject(new Error("Video load failed"));
    });

    return thumbnail;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readImageFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 960;
        const maxHeight = 540;
        const widthRatio = maxWidth / image.width;
        const heightRatio = maxHeight / image.height;
        const scale = Math.min(1, widthRatio, heightRatio);
        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas not supported"));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.onerror = () => reject(new Error("Image load failed"));
      image.src = String(reader.result || "");
    };

    reader.onerror = () => reject(new Error("Image load failed"));
    reader.readAsDataURL(file);
  });
}

function inferCategoryFromTitle(title) {
  const lower = title.toLowerCase();

  if (lower.includes("music") || lower.includes("song")) return "Music";
  if (lower.includes("game") || lower.includes("play")) return "Gaming";
  if (lower.includes("code") || lower.includes("react") || lower.includes("app")) return "Coding";
  if (lower.includes("blockchain") || lower.includes("crypto") || lower.includes("web3")) return "Blockchain";

  return "Education";
}

function getCategory(value) {
  if (typeof value === "object" && value !== null) {
    return value.category || inferCategoryFromTitle(value.title || "");
  }

  return inferCategoryFromTitle(value || "");
}

function formatTimestamp(value) {
  if (!value) {
    return "just now";
  }

  const date = new Date(Number(value) * 1000);
  return date.toLocaleDateString();
}

function getStorageArray(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function getThumbnailStore() {
  return getStorageObject("web3tube-thumbnails", {});
}

function setThumbnailStore(value) {
  return setStorageJson("web3tube-thumbnails", value);
}

function getCategoryStore() {
  return getStorageObject("web3tube-categories", {});
}

function setCategoryStore(value) {
  return setStorageJson("web3tube-categories", value);
}

function getProfileStore() {
  return getStorageObject("web3tube-profile-names", {});
}

function setProfileStore(value) {
  return setStorageJson("web3tube-profile-names", value);
}

function getDeletedVideosStore() {
  return getStorageObject("web3tube-deleted-videos", {});
}

function setDeletedVideosStore(value) {
  return setStorageJson("web3tube-deleted-videos", value);
}

function setStorageArray(key, value) {
  return setStorageJson(key, value);
}

function getStorageObject(key, fallback = {}) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function setStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function getRelativeProgressLabel(seconds) {
  if (!seconds) {
    return "Start now";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `Resume at ${mins}:${String(secs).padStart(2, "0")}`;
}

function getInteractionStore() {
  return getStorageObject("web3tube-interactions", {});
}

function setInteractionStore(value) {
  return setStorageJson("web3tube-interactions", value);
}

function applyLocalVideoData(videos) {
  const interactions = getInteractionStore();
  const thumbnails = getThumbnailStore();
  const categoryStore = getCategoryStore();
  const deletedVideos = getDeletedVideosStore();

  return videos.map((video) => {
    const local = interactions[video.id] || {};

    return {
      ...video,
      thumbnailUrl: thumbnails[video.hash] || video.thumbnailUrl || "",
      category: categoryStore[video.hash] || video.category || inferCategoryFromTitle(video.title || ""),
      views: local.views ?? video.views ?? 0,
      likes: local.likes ?? video.likes ?? 0,
      commentCount: local.commentCount ?? video.commentCount ?? 0,
      likedByWallet: local.likedByWallet ?? video.likedByWallet ?? false
    };
  }).filter((video) => !deletedVideos[video.hash]);
}

function getLocalComments(videoId) {
  const interactions = getInteractionStore();
  return interactions[videoId]?.comments || [];
}

function updateLocalInteraction(videoId, updater) {
  const interactions = getInteractionStore();
  const current = interactions[videoId] || {};
  const next = updater(current);
  interactions[videoId] = next;
  setInteractionStore(interactions);
  return next;
}

async function syncVideoToDatabase(video) {
  try {
    await fetch(`${databaseApiBase}/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contractVideoId: video.id,
        title: video.title,
        hash: video.hash,
        thumbnailUrl: video.thumbnailUrl || "",
        category: video.category || "",
        author: video.author,
        createdAt: video.createdAt,
        source: "blockchain"
      })
    });
  } catch (error) {
    // The blockchain flow should still work even if the DB server is offline.
  }
}

async function deleteVideoFromDatabase(video) {
  try {
    await fetch(`${databaseApiBase}/videos/${video.id}?hash=${encodeURIComponent(video.hash)}`, {
      method: "DELETE"
    });
  } catch (error) {
    // Local UI delete should still work even if DB delete fails.
  }
}

async function fetchDatabaseVideos() {
  try {
    const response = await fetch(`${databaseApiBase}/videos`);
    const payload = await response.json();

    return (payload.videos || []).map((video, index) => ({
      id: Number(video.contractVideoId ?? video.id ?? index + 1),
      hash: video.hash,
      thumbnailUrl: video.thumbnailUrl || "",
      category: video.category || "",
      title: video.title,
      author: video.author || "",
      createdAt: Number(video.createdAt ?? Math.floor(Date.now() / 1000)),
      views: Number(video.views ?? 0),
      likes: Number(video.likes ?? 0),
      commentCount: Number(video.commentCount ?? 0),
      likedByWallet: false
    }));
  } catch (error) {
    return [];
  }
}

function loadFallbackVideos(setVideos, setSelectedVideoId, setComments, setBanner) {
  setVideos(applyLocalVideoData(demoVideos));
  setSelectedVideoId(demoVideos[0].id);
  const baseComments = [
    {
      id: 1,
      author: "0xDemo000000000000000000000000000000000001",
      text: "Fallback demo comment: the local sample video is ready to play.",
      createdAt: 1710010800
    }
  ];
  setComments([...getLocalComments(demoVideos[0].id), ...baseComments].reverse());
  setBanner("Showing built-in demo videos. Blockchain data can be added anytime.");
}

function getRpcProvider() {
  return new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
}

const localhostChainHex = "0x7a69";

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [selectedPage, setSelectedPage] = useState("Home");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortMode, setSortMode] = useState("Latest");
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [hashInput, setHashInput] = useState("");
  const [thumbnailInput, setThumbnailInput] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Education");
  const [uploadedThumbnailImage, setUploadedThumbnailImage] = useState("");
  const [autoThumbnail, setAutoThumbnail] = useState("");
  const [selectedVideoFileName, setSelectedVideoFileName] = useState("");
  const [selectedThumbnailFileName, setSelectedThumbnailFileName] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState([]);
  const [watchLaterIds, setWatchLaterIds] = useState([]);
  const [historyIds, setHistoryIds] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistName, setPlaylistName] = useState("");
  const [videoNotes, setVideoNotes] = useState({});
  const [profileName, setProfileName] = useState("");
  const [profileStore, setProfileStoreState] = useState({});
  const [theme, setTheme] = useState("dark");
  const [drafts, setDrafts] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [watchProgress, setWatchProgress] = useState({});
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);
  const [banner, setBanner] = useState("Connect your wallet and manage your decentralized video platform.");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [recordingView, setRecordingView] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [playbackAttempt, setPlaybackAttempt] = useState(0);

  const filteredVideos = useMemo(() => {
    const results = videos.filter((video) => {
      const localCommentText = getLocalComments(video.id)
        .map((comment) => comment.text.toLowerCase())
        .join(" ");
      const matchesCategory =
        activeCategory === "All" ||
        (activeCategory === "Trending" ? true : getCategory(video) === activeCategory);
      const matchesSearch =
        !search.trim() ||
        video.title.toLowerCase().includes(search.toLowerCase()) ||
        video.author.toLowerCase().includes(search.toLowerCase()) ||
        localCommentText.includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });

    return [...results].sort((first, second) => {
      if (sortMode === "Most Viewed") {
        return second.views - first.views;
      }

      if (sortMode === "Most Liked") {
        return second.likes - first.likes;
      }

      if (sortMode === "Most Discussed") {
        return second.commentCount - first.commentCount;
      }

      return second.id - first.id;
    });
  }, [activeCategory, search, sortMode, videos]);

  const selectedVideo =
    filteredVideos.find((video) => video.id === selectedVideoId) ||
    videos.find((video) => video.id === selectedVideoId) ||
    filteredVideos[0] ||
    videos[0] ||
    null;

  const trendingVideos = useMemo(() => {
    return [...videos]
      .sort((first, second) => {
        const firstScore = first.views + first.likes * 3 + first.commentCount * 2;
        const secondScore = second.views + second.likes * 3 + second.commentCount * 2;
        return secondScore - firstScore;
      })
      .slice(0, 4);
  }, [videos]);

  const watchLaterVideos = useMemo(() => {
    return watchLaterIds
      .map((id) => videos.find((video) => video.id === id))
      .filter(Boolean);
  }, [videos, watchLaterIds]);

  const historyVideos = useMemo(() => {
    return historyIds
      .map((id) => videos.find((video) => video.id === id))
      .filter(Boolean);
  }, [historyIds, videos]);

  const playlistCards = useMemo(() => {
    return playlists.map((playlist) => ({
      ...playlist,
      videos: playlist.videoIds
        .map((id) => videos.find((video) => video.id === id))
        .filter(Boolean)
    }));
  }, [playlists, videos]);

  const channelVideos = useMemo(() => {
    if (!account) {
      return [];
    }

    return videos.filter((video) => video.author.toLowerCase() === account.toLowerCase());
  }, [account, videos]);

  const creatorAnalytics = useMemo(() => {
    const totalViews = channelVideos.reduce((sum, video) => sum + video.views, 0);
    const totalLikes = channelVideos.reduce((sum, video) => sum + video.likes, 0);
    const totalComments = channelVideos.reduce((sum, video) => sum + video.commentCount, 0);
    const engagement = totalViews + totalLikes * 4 + totalComments * 6;

    return { totalViews, totalLikes, totalComments, engagement };
  }, [channelVideos]);

  const subscribedVideos = useMemo(() => {
    return videos.filter((video) => subscriptions.includes(video.author.toLowerCase()));
  }, [subscriptions, videos]);

  const continueWatchingVideos = useMemo(() => {
    return Object.entries(watchProgress)
      .map(([id, seconds]) => ({
        video: videos.find((item) => item.id === Number(id)),
        seconds
      }))
      .filter((item) => item.video && item.seconds > 0)
      .sort((first, second) => second.seconds - first.seconds)
      .slice(0, 4);
  }, [videos, watchProgress]);

  const hasMetaMask = Boolean(window.ethereum);
  const isWalletConnected = Boolean(account);
  const isCorrectNetwork = !chainId || chainId === localhostChainHex;

  function getDisplayName(address) {
    if (!address) {
      return "Creator";
    }

    return profileStore[address.toLowerCase()] || formatAddress(address);
  }

  function renderVideoCard(
    video,
    {
      badge,
      compact = false,
      subtitle,
      meta,
      showActions = false,
      keyPrefix = "video"
    } = {}
  ) {
    const thumbnailUrl = getResolvedThumbnail(video);
    const categoryLabel = getCategory(video);
    const metaLine = meta || `${video.views} views | ${video.likes} likes | ${formatTimestamp(video.createdAt)}`;
    const subtitleLine = subtitle || formatAddress(video.author);

    return (
      <article key={`${keyPrefix}-${video.id}`} className={`video-card ${compact ? "video-card-compact" : ""}`}>
        <button
          type="button"
          className="video-card-preview"
          onClick={() => openVideo(video)}
        >
          <div className={`video-card-thumb ${thumbnailUrl ? "has-image" : "no-image"}`}>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={`${video.title} thumbnail`} className="video-card-thumb-image" />
            ) : (
              <div className="video-card-thumb-fallback">
                <strong>{categoryLabel}</strong>
                <span>Preview unavailable</span>
              </div>
            )}
            {badge ? <span className="video-card-badge">{badge}</span> : null}
            <span className="video-card-category">{categoryLabel}</span>
          </div>
        </button>

        <div className="video-card-body">
          <strong>{video.title}</strong>
          <span>{subtitleLine}</span>
          <small>{metaLine}</small>
          <small>{video.commentCount > 0 ? `${video.commentCount} comments` : "No comments yet"}</small>
          {showActions ? (
            <div className="card-actions">
              <button type="button" onClick={() => shareVideo(video)}>Share</button>
              <button type="button" onClick={() => handleDeleteVideo(video)}>Remove</button>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function getProvider() {
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    return new ethers.providers.Web3Provider(window.ethereum);
  }

  async function getReadContract() {
    const provider = getRpcProvider();

    return new ethers.Contract(contractAddress, abi, provider);
  }

  async function getWriteContract() {
    const provider = getProvider();
    const signer = provider.getSigner();

    return new ethers.Contract(contractAddress, abi, signer);
  }

  async function updateWalletSnapshot() {
    if (!window.ethereum) {
      setAccount("");
      setChainId("");
      return;
    }

    const [accounts, currentChainId] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" })
    ]);

    setAccount(accounts[0] || "");
    setChainId(currentChainId || "");
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setBanner("MetaMask not found. Install it to connect your wallet.");
      return;
    }

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    setAccount(accounts[0] || "");
    setBanner("Wallet connected. Your creator channel is ready.");
  }

  async function switchToLocalhost() {
    if (!window.ethereum) {
      setBanner("MetaMask not found. Install it first.");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: localhostChainHex }]
      });
      setBanner("Switched to Localhost 8545.");
    } catch (error) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: localhostChainHex,
              chainName: "Localhost 8545",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18
              }
            }
          ]
        });
        setBanner("Localhost 8545 added to MetaMask.");
      } catch (innerError) {
        setBanner("Could not switch network automatically.");
      }
    }
  }

  function disconnectWallet() {
    setAccount("");
    setChainId("");
    setWalletPanelOpen(false);
    setBanner("Wallet disconnected from app view.");
  }

  async function loadComments(video, contractInstance) {
    if (!video) {
      setComments([]);
      return;
    }

    const localComments = getLocalComments(video.id);
    const commentItems = [];

    try {
      const contract = contractInstance || (await getReadContract());

      for (let id = 1; id <= video.commentCount; id += 1) {
        const comment = await contract.getComment(video.id, id);

        commentItems.push({
          id,
          author: comment[0],
          text: comment[1],
          createdAt: comment[2].toNumber ? comment[2].toNumber() : Number(comment[2])
        });
      }
    } catch (error) {
      // Local/demo videos may not have on-chain comments yet.
    }

    setComments([...localComments, ...commentItems].reverse());
  }

  async function loadVideos(preferredSelectedId = null) {
    if (!window.ethereum) {
      setVideos([]);
      setSelectedVideoId(null);
      setComments([]);
      setLoading(false);
      setBanner("MetaMask not found. Install it to use this dapp.");
      return;
    }

    try {
      setLoading(true);
      await updateWalletSnapshot();

      const walletAccounts = await window.ethereum.request({ method: "eth_accounts" });
      const activeAccount = walletAccounts[0] || "";
      const contract = await getReadContract();
      const databaseVideos = await fetchDatabaseVideos();
      const persistedVideosByHash = new Map(databaseVideos.map((video) => [video.hash, video]));
      const count = await contract.videoCount();
      const totalVideos = count.toNumber();

      if (totalVideos === 0) {
        if (databaseVideos.length > 0) {
          const hydratedVideos = applyLocalVideoData(databaseVideos);
          const nextSelectedId = resolveSelectedVideoId(
            hydratedVideos,
            preferredSelectedId ?? selectedVideoId
          );
          setVideos(hydratedVideos);
          setSelectedVideoId(nextSelectedId);
          setComments([]);
          setBanner(`${databaseVideos.length} videos loaded from MongoDB.`);
          return;
        }

        loadFallbackVideos(setVideos, setSelectedVideoId, setComments, setBanner);
        return;
      }

      const loadedVideos = [];

      for (let id = totalVideos; id >= 1; id -= 1) {
        const entry = await contract.videos(id);
        const likedByWallet = activeAccount
          ? await contract.hasLiked(id, activeAccount)
          : false;

        loadedVideos.push({
          id: entry.id.toNumber ? entry.id.toNumber() : Number(entry.id),
          hash: entry.hash || entry[1],
          thumbnailUrl: persistedVideosByHash.get(entry.hash || entry[1])?.thumbnailUrl || "",
          category: persistedVideosByHash.get(entry.hash || entry[1])?.category || "",
          title: entry.title || entry[2],
          author: entry.author || entry[3],
          createdAt: entry.createdAt.toNumber ? entry.createdAt.toNumber() : Number(entry[4]),
          views: entry.views.toNumber ? entry.views.toNumber() : Number(entry[5]),
          likes: entry.likes.toNumber ? entry.likes.toNumber() : Number(entry[6]),
          commentCount: entry.commentCount.toNumber ? entry.commentCount.toNumber() : Number(entry[7]),
          likedByWallet
        });
      }

      const hydratedVideos = applyLocalVideoData(loadedVideos);
      setVideos(hydratedVideos);
      await Promise.all(hydratedVideos.map((video) => syncVideoToDatabase(video)));

      const nextSelectedId = resolveSelectedVideoId(
        hydratedVideos,
        preferredSelectedId ?? selectedVideoId
      );
      setSelectedVideoId(nextSelectedId);

      const activeVideo = hydratedVideos.find((video) => video.id === nextSelectedId) || hydratedVideos[0];
      await loadComments(activeVideo, contract);

      setBanner(`${hydratedVideos.length} videos loaded from the smart contract.`);
    } catch (error) {
      const databaseVideos = await fetchDatabaseVideos();

      if (databaseVideos.length > 0) {
        const hydratedVideos = applyLocalVideoData(databaseVideos);
        const nextSelectedId = resolveSelectedVideoId(
          hydratedVideos,
          preferredSelectedId ?? selectedVideoId
        );
        setVideos(hydratedVideos);
        setSelectedVideoId(nextSelectedId);
        setComments([]);
        setBanner(`${databaseVideos.length} videos loaded from MongoDB.`);
        return;
      }

      loadFallbackVideos(setVideos, setSelectedVideoId, setComments, setBanner);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();

    const normalizedHash = normalizeIpfsHash(hashInput);

    if (!title.trim() || !normalizedHash) {
      setBanner("Video title and IPFS hash are required.");
      return;
    }

    try {
      setUploading(true);

      if (!account) {
        await connectWallet();
      }

      setBanner("Waiting for MetaMask confirmation to upload your video...");

      const contract = await getWriteContract();
      const tx = await contract.uploadVideo(normalizedHash, title.trim());
      await tx.wait();

      const latestCount = await contract.videoCount();
      const latestId = latestCount.toNumber ? latestCount.toNumber() : Number(latestCount);
      const finalThumbnail = thumbnailInput.trim() || uploadedThumbnailImage || autoThumbnail;
      const newVideo = {
        id: latestId,
        hash: normalizedHash,
        thumbnailUrl: finalThumbnail,
        category: uploadCategory,
        title: title.trim(),
        author: account || "",
        createdAt: Math.floor(Date.now() / 1000),
        views: 0,
        likes: 0,
        commentCount: 0,
        likedByWallet: false
      };

      if (finalThumbnail) {
        const thumbnails = getThumbnailStore();
        thumbnails[normalizedHash] = finalThumbnail;
        if (!setThumbnailStore(thumbnails)) {
          setBanner("Video uploaded, but the thumbnail was too large to save locally.");
        }
      }

      const categoryStore = getCategoryStore();
      categoryStore[normalizedHash] = uploadCategory;
      setCategoryStore(categoryStore);

      const deletedVideos = getDeletedVideosStore();
      if (deletedVideos[normalizedHash]) {
        delete deletedVideos[normalizedHash];
        setDeletedVideosStore(deletedVideos);
      }

      await syncVideoToDatabase(newVideo);
      setVideos((current) => {
        const next = [newVideo, ...current.filter((video) => video.id !== newVideo.id)];
        return next.sort((first, second) => second.id - first.id);
      });

      setTitle("");
      setHashInput("");
      setThumbnailInput("");
      setUploadCategory("Education");
      setUploadedThumbnailImage("");
      setAutoThumbnail("");
      setSelectedVideoFileName("");
      setSelectedThumbnailFileName("");
      clearDrafts();
      setSelectedVideoId(latestId);
      setSelectedPage("Watch");
      setActiveCategory("All");
      setSortMode("Latest");
      setSearch("");
      setComments([]);
      setBanner("Video uploaded successfully.");
      pushNotification(`Video uploaded: ${title.trim()}`);
      await loadVideos(latestId);
    } catch (error) {
      setBanner("Upload failed. Check MetaMask, Localhost 8545, and the Hardhat node.");
    } finally {
      setUploading(false);
    }
  }

  async function handleToggleLike() {
    if (!selectedVideo) {
      return;
    }

    const currentLiked = Boolean(selectedVideo.likedByWallet);
    const nextLiked = !currentLiked;
    const nextLikes = Math.max(0, (selectedVideo.likes ?? 0) + (nextLiked ? 1 : -1));

    try {
      setLiking(true);

      if (!account) {
        await connectWallet();
      }

      const contract = await getWriteContract();
      const tx = await contract.toggleLike(selectedVideo.id);
      await tx.wait();

      updateLocalInteraction(selectedVideo.id, (current) => ({
        ...current,
        views: current.views ?? selectedVideo.views ?? 0,
        likes: nextLikes,
        commentCount: current.commentCount ?? selectedVideo.commentCount ?? 0,
        likedByWallet: nextLiked,
        comments: current.comments || []
      }));
      setVideos((currentVideos) =>
        currentVideos.map((video) =>
          video.id === selectedVideo.id
            ? { ...video, likes: nextLikes, likedByWallet: nextLiked }
            : video
        )
      );
      await loadVideos();
      setBanner("Like status updated.");
      pushNotification(`Like updated for ${selectedVideo.title}`);
    } catch (error) {
      updateLocalInteraction(selectedVideo.id, (current) => ({
        ...current,
        views: current.views ?? selectedVideo.views ?? 0,
        likes: nextLikes,
        commentCount: current.commentCount ?? selectedVideo.commentCount ?? 0,
        likedByWallet: nextLiked,
        comments: current.comments || []
      }));
      setVideos((currentVideos) =>
        currentVideos.map((video) =>
          video.id === selectedVideo.id
            ? { ...video, likes: nextLikes, likedByWallet: nextLiked }
            : video
        )
      );
      setBanner("Like updated locally.");
      pushNotification(`Like updated for ${selectedVideo.title}`);
    } finally {
      setLiking(false);
    }
  }

  async function handleAddComment(event) {
    event.preventDefault();

    if (!selectedVideo || !commentInput.trim()) {
      setBanner("Comment cannot be empty.");
      return;
    }

    const nextComment = {
      id: Date.now(),
      author: account || "Local User",
      text: commentInput.trim(),
      createdAt: Math.floor(Date.now() / 1000)
    };

    try {
      setCommenting(true);

      if (!account) {
        await connectWallet();
      }

      const contract = await getWriteContract();
      const tx = await contract.addComment(selectedVideo.id, commentInput.trim());
      await tx.wait();

      const nextCommentCount = (selectedVideo.commentCount ?? 0) + 1;
      updateLocalInteraction(selectedVideo.id, (current) => ({
        ...current,
        views: current.views ?? selectedVideo.views ?? 0,
        likes: current.likes ?? selectedVideo.likes ?? 0,
        likedByWallet: current.likedByWallet ?? selectedVideo.likedByWallet ?? false,
        comments: [...(current.comments || []), nextComment],
        commentCount: nextCommentCount
      }));
      setComments((currentComments) => [nextComment, ...currentComments]);
      setVideos((currentVideos) =>
        currentVideos.map((video) =>
          video.id === selectedVideo.id ? { ...video, commentCount: nextCommentCount } : video
        )
      );
      setCommentInput("");
      await loadVideos();
      setBanner("Comment added successfully.");
      pushNotification(`Comment posted on ${selectedVideo.title}`);
    } catch (error) {
      const nextCommentCount = (selectedVideo.commentCount ?? 0) + 1;
      updateLocalInteraction(selectedVideo.id, (current) => ({
        ...current,
        views: current.views ?? selectedVideo.views ?? 0,
        likes: current.likes ?? selectedVideo.likes ?? 0,
        likedByWallet: current.likedByWallet ?? selectedVideo.likedByWallet ?? false,
        comments: [...(current.comments || []), nextComment],
        commentCount: nextCommentCount
      }));
      setComments((currentComments) => [nextComment, ...currentComments]);
      setVideos((currentVideos) =>
        currentVideos.map((video) =>
          video.id === selectedVideo.id ? { ...video, commentCount: nextCommentCount } : video
        )
      );
      setCommentInput("");
      setBanner("Comment added locally.");
      pushNotification(`Comment posted on ${selectedVideo.title}`);
    } finally {
      setCommenting(false);
    }
  }

  async function handleRecordView(video) {
    if (!video) {
      return;
    }

    const nextViews = (video.views ?? 0) + 1;

    try {
      setRecordingView(true);

      if (!account) {
        await connectWallet();
      }

      const contract = await getWriteContract();
      const tx = await contract.viewVideo(video.id);
      await tx.wait();

      updateLocalInteraction(video.id, (current) => ({
        ...current,
        views: nextViews,
        likes: current.likes ?? video.likes ?? 0,
        commentCount: current.commentCount ?? video.commentCount ?? 0,
        likedByWallet: current.likedByWallet ?? video.likedByWallet ?? false,
        comments: current.comments || []
      }));
      setVideos((currentVideos) =>
        currentVideos.map((item) => (item.id === video.id ? { ...item, views: nextViews } : item))
      );
      setSelectedVideoId(video.id);
      setSelectedPage("Watch");
      await loadVideos();
      setBanner("View recorded on-chain.");
      pushNotification(`View recorded for ${video.title}`);
    } catch (error) {
      updateLocalInteraction(video.id, (current) => ({
        ...current,
        views: nextViews,
        likes: current.likes ?? video.likes ?? 0,
        commentCount: current.commentCount ?? video.commentCount ?? 0,
        likedByWallet: current.likedByWallet ?? video.likedByWallet ?? false,
        comments: current.comments || []
      }));
      setVideos((currentVideos) =>
        currentVideos.map((item) => (item.id === video.id ? { ...item, views: nextViews } : item))
      );
      setSelectedVideoId(video.id);
      setSelectedPage("Watch");
      setBanner("View recorded locally.");
      pushNotification(`View recorded for ${video.title}`);
    } finally {
      setRecordingView(false);
    }
  }

  function rememberWatch(videoId) {
    setHistoryIds((current) => {
      const next = [videoId, ...current.filter((id) => id !== videoId)].slice(0, 10);
      setStorageArray("web3tube-history", next);
      return next;
    });
  }

  function toggleWatchLater(videoId) {
    setWatchLaterIds((current) => {
      const next = current.includes(videoId)
        ? current.filter((id) => id !== videoId)
        : [videoId, ...current];

      setStorageArray("web3tube-watch-later", next);
      return next;
    });
  }

  function toggleSubscription(author) {
    const normalizedAuthor = author.toLowerCase();

    setSubscriptions((current) => {
      const next = current.includes(normalizedAuthor)
        ? current.filter((value) => value !== normalizedAuthor)
        : [normalizedAuthor, ...current];

      setStorageArray("web3tube-subscriptions", next);
      return next;
    });
  }

  function pushNotification(text) {
    const nextNotifications = [{ id: Date.now(), text }, ...notifications].slice(0, 6);
    setNotifications(nextNotifications);
    setStorageArray("web3tube-notifications", nextNotifications);
  }

  function createPlaylist() {
    const trimmedName = playlistName.trim();

    if (!trimmedName) {
      setBanner("Playlist name required.");
      return;
    }

    const baseVideoIds = selectedVideo ? [selectedVideo.id] : [];
    const nextPlaylists = [
      {
        id: Date.now(),
        name: trimmedName,
        videoIds: baseVideoIds
      },
      ...playlists
    ];

    setPlaylists(nextPlaylists);
    setStorageArray("web3tube-playlists", nextPlaylists);
    setPlaylistName("");
    setBanner(baseVideoIds.length > 0 ? "Playlist created with current video." : "Empty playlist created.");
    pushNotification(`Playlist created: ${trimmedName}`);
  }

  function saveCurrentToPlaylist(playlistId) {
    if (!selectedVideo) {
      setBanner("Open a video first.");
      return;
    }

    const nextPlaylists = playlists.map((playlist) => {
      if (playlist.id !== playlistId) {
        return playlist;
      }

      if (playlist.videoIds.includes(selectedVideo.id)) {
        return playlist;
      }

      return {
        ...playlist,
        videoIds: [selectedVideo.id, ...playlist.videoIds]
      };
    });

    setPlaylists(nextPlaylists);
    setStorageArray("web3tube-playlists", nextPlaylists);
    setBanner("Video added to playlist.");
    pushNotification(`Added to playlist: ${selectedVideo.title}`);
  }

  function saveVideoNote(videoId, note) {
    const nextNotes = {
      ...videoNotes,
      [videoId]: note
    };

    setVideoNotes(nextNotes);
    window.localStorage.setItem("web3tube-video-notes", JSON.stringify(nextNotes));
    setBanner("Video note saved.");
  }

  function saveProfileName() {
    const trimmedName = profileName.trim();

    if (!account) {
      setBanner("Connect a wallet to save a channel name.");
      return;
    }

    const normalizedAccount = account.toLowerCase();
    const nextProfiles = {
      ...profileStore
    };

    if (trimmedName) {
      nextProfiles[normalizedAccount] = trimmedName;
    } else {
      delete nextProfiles[normalizedAccount];
    }

    setProfileStoreState(nextProfiles);
    setProfileStore(nextProfiles);
    setBanner(trimmedName ? "Creator profile updated." : "Creator profile cleared.");
    if (trimmedName) {
      pushNotification(`Profile updated: ${trimmedName}`);
    }
  }

  function updateDraft(field, value) {
    const nextDrafts = {
      ...drafts,
      [field]: value
    };

    setDrafts(nextDrafts);
    window.localStorage.setItem("web3tube-upload-draft", JSON.stringify(nextDrafts));
  }

  function clearDrafts() {
    const nextDrafts = { title: "", hashInput: "", thumbnailInput: "", uploadCategory: "Education" };
    setDrafts(nextDrafts);
    window.localStorage.setItem("web3tube-upload-draft", JSON.stringify(nextDrafts));
    setTitle("");
    setHashInput("");
    setThumbnailInput("");
    setUploadCategory("Education");
    setAutoThumbnail("");
    setSelectedVideoFileName("");
    setSelectedThumbnailFileName("");
    setUploadedThumbnailImage("");
  }

  function handlePlayerProgress(event, videoId) {
    const seconds = Math.floor(event.target.currentTime || 0);
    const nextProgress = {
      ...watchProgress,
      [videoId]: seconds
    };

    setWatchProgress(nextProgress);
    window.localStorage.setItem("web3tube-watch-progress", JSON.stringify(nextProgress));
  }

  function clearNotifications() {
    setNotifications([]);
    setStorageArray("web3tube-notifications", []);
  }

  function shareVideo(video) {
    const shareUrl = `${window.location.origin}?video=${video.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl);
      setBanner("Share link copied to clipboard.");
      return;
    }

    window.prompt("Copy this share link", shareUrl);
    setBanner("Share link ready to copy.");
  }

  async function handleDeleteVideo(video) {
    if (!video) {
      return;
    }

    const confirmed = window.confirm(`Remove "${video.title}" from the app?`);
    if (!confirmed) {
      return;
    }

    const deletedVideos = getDeletedVideosStore();
    deletedVideos[video.hash] = true;
    setDeletedVideosStore(deletedVideos);

    await deleteVideoFromDatabase(video);

    setVideos((current) => {
      const next = current.filter((item) => item.id !== video.id && item.hash !== video.hash);
      const nextSelected = next[0] || null;
      setSelectedVideoId(nextSelected ? nextSelected.id : null);
      if (!nextSelected) {
        setComments([]);
      }
      return next;
    });

    setWatchLaterIds((current) => {
      const next = current.filter((id) => id !== video.id);
      setStorageArray("web3tube-watch-later", next);
      return next;
    });
    setHistoryIds((current) => {
      const next = current.filter((id) => id !== video.id);
      setStorageArray("web3tube-history", next);
      return next;
    });
    setPlaylists((current) => {
      const next = current.map((playlist) => ({
        ...playlist,
        videoIds: playlist.videoIds.filter((id) => id !== video.id)
      }));
      setStorageArray("web3tube-playlists", next);
      return next;
    });

    setBanner("Video removed from the app.");
    pushNotification(`Removed video: ${video.title}`);
  }

  function handleSearch() {
    setSelectedPage("Home");
    setActiveCategory("All");
    setSortMode("Latest");

    if (filteredVideos.length > 0) {
      setSelectedVideoId(filteredVideos[0].id);
      setBanner(`${filteredVideos.length} search results found.`);
    } else if (search.trim()) {
      setBanner("No matching videos found.");
    } else {
      setBanner("Showing all videos.");
    }
  }

  function openVideo(video, nextPage = "Watch") {
    setSelectedVideoId(video.id);
    setSelectedPage(nextPage);
    rememberWatch(video.id);
    loadComments(video);
  }

  useEffect(() => {
    setWatchLaterIds(getStorageArray("web3tube-watch-later"));
    setHistoryIds(getStorageArray("web3tube-history"));
    setSubscriptions(getStorageArray("web3tube-subscriptions"));
    setPlaylists(getStorageArray("web3tube-playlists"));
    setVideoNotes(getStorageObject("web3tube-video-notes"));
    setProfileStoreState(getProfileStore());
    setTheme(window.localStorage.getItem("web3tube-theme") || "dark");
    setDrafts(getStorageObject("web3tube-upload-draft", { title: "", hashInput: "", thumbnailInput: "", uploadCategory: "Education" }));
    setNotifications(getStorageArray("web3tube-notifications"));
    setWatchProgress(getStorageObject("web3tube-watch-progress"));
  }, []);

  useEffect(() => {
    if (!account) {
      setProfileName("");
      return;
    }

    setProfileName(profileStore[account.toLowerCase()] || "");
  }, [account, profileStore]);

  useEffect(() => {
    if (drafts.title !== undefined) {
      setTitle(drafts.title || "");
    }

    if (drafts.hashInput !== undefined) {
      setHashInput(drafts.hashInput || "");
    }

    if (drafts.thumbnailInput !== undefined) {
      setThumbnailInput(drafts.thumbnailInput || "");
    }

    if (drafts.uploadCategory !== undefined) {
      setUploadCategory(drafts.uploadCategory || "Education");
    }
  }, [drafts]);

  useEffect(() => {
    if (selectedVideo) {
      loadComments(selectedVideo);
    } else {
      setComments([]);
    }
    // Keep comments synced with the selected video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, videos]);

  useEffect(() => {
    if (!selectedVideo) {
      setPlaybackAttempt(0);
      setPlaybackUrl("");
      return;
    }

    const urls = getVideoGatewayUrls(selectedVideo.hash);
    setPlaybackAttempt(0);
    setPlaybackUrl(urls[0] || "/demo-video.mp4");
  }, [selectedVideo]);

  useEffect(() => {
    if (!videos.length) {
      if (selectedVideoId !== null) {
        setSelectedVideoId(null);
      }
      return;
    }

    if (!videos.some((video) => video.id === selectedVideoId)) {
      setSelectedVideoId(videos[0].id);
      return;
    }

    if (
      selectedPage === "Home" &&
      filteredVideos.length > 0 &&
      !filteredVideos.some((video) => video.id === selectedVideoId)
    ) {
      setSelectedVideoId(filteredVideos[0].id);
    }
  }, [filteredVideos, selectedPage, selectedVideoId, videos]);

  useEffect(() => {
    loadVideos();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleVideoPlaybackError() {
    if (!selectedVideo) {
      return;
    }

    const urls = getVideoGatewayUrls(selectedVideo.hash);
    const nextAttempt = playbackAttempt + 1;

    if (nextAttempt < urls.length) {
      setPlaybackAttempt(nextAttempt);
      setPlaybackUrl(urls[nextAttempt]);

      if (urls[nextAttempt] === "/demo-video.mp4") {
        setBanner("IPFS playback failed, so a local demo video is being shown instead.");
      }

      return;
    }

    setPlaybackUrl("/demo-video.mp4");
    setBanner("Could not stream this uploaded video from IPFS. Showing the local demo video instead.");
  }

  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }

    function handleAccountsChanged(accounts) {
      setAccount(accounts[0] || "");
      loadVideos();
    }

    function handleChainChanged(newChainId) {
      setChainId(newChainId);
      loadVideos();
    }

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
    // Keep listeners stable for the page session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`yt-app theme-${theme}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="play-triangle" />
          </div>
          <div>
            <strong>Web3Tube</strong>
            <span>creator platform</span>
          </div>
        </div>

        <div className="search-shell">
          <input
            type="text"
            placeholder="Search videos, creators, comments"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearch();
              }
            }}
          />
          <button type="button" className="search-button" onClick={handleSearch}>
            Search
          </button>
        </div>

        <div className="top-actions">
          <button type="button" className="top-pill" onClick={loadVideos}>
            Refresh
          </button>
          <button
            type="button"
            className="top-pill"
            onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setTheme(nextTheme);
              window.localStorage.setItem("web3tube-theme", nextTheme);
            }}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            type="button"
            className="top-pill strong"
            onClick={() => {
              if (isWalletConnected) {
                setWalletPanelOpen((current) => !current);
              } else {
                connectWallet();
              }
            }}
          >
            {account ? formatAddress(account) : "Connect Wallet"}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-group">
            {pages.map((page) => (
              <button
                key={page}
                type="button"
                className={`nav-item ${selectedPage === page ? "active" : ""}`}
                onClick={() => setSelectedPage(page)}
              >
                {page}
              </button>
            ))}
          </div>

          <div className="sidebar-group">
            <h3>Studio</h3>
            <form className="studio-form" onSubmit={handleUpload}>
              <input
                type="text"
                placeholder="Video title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  updateDraft("title", event.target.value);
                }}
              />
              <input
                type="text"
                placeholder="IPFS hash or ipfs://"
                value={hashInput}
                onChange={(event) => {
                  setHashInput(event.target.value);
                  updateDraft("hashInput", event.target.value);
                }}
              />
              <input
                type="text"
                placeholder="Thumbnail image URL"
                value={thumbnailInput}
                onChange={(event) => {
                  setThumbnailInput(event.target.value);
                  updateDraft("thumbnailInput", event.target.value);
                }}
              />
              <select
                value={uploadCategory}
                onChange={(event) => {
                  setUploadCategory(event.target.value);
                  updateDraft("uploadCategory", event.target.value);
                }}
              >
                {uploadCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <label className="file-picker">
                <span>Choose thumbnail from image file</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    try {
                      setSelectedThumbnailFileName(file.name);
                      const imageData = await readImageFileAsDataUrl(file);
                      setUploadedThumbnailImage(imageData);
                      setBanner("Thumbnail image selected from your gallery.");
                    } catch (error) {
                      setBanner("Could not load this image file.");
                    }
                  }}
                />
              </label>
              <label className="file-picker">
                <span>Auto thumbnail from video file</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    try {
                      setSelectedVideoFileName(file.name);
                      const generatedThumbnail = await generateThumbnailFromFile(file);
                      setAutoThumbnail(generatedThumbnail);
                      setBanner("Thumbnail generated from selected video file.");
                    } catch (error) {
                      setBanner("Could not generate thumbnail from this file.");
                    }
                  }}
                />
              </label>
              {(thumbnailInput || uploadedThumbnailImage || autoThumbnail) && (
                <div className="thumbnail-preview">
                  <img src={thumbnailInput || uploadedThumbnailImage || autoThumbnail} alt="Thumbnail preview" />
                  <span>
                    {thumbnailInput
                      ? "Manual thumbnail URL"
                      : uploadedThumbnailImage
                        ? `Image file thumbnail${selectedThumbnailFileName ? `: ${selectedThumbnailFileName}` : ""}`
                        : `Auto thumbnail${selectedVideoFileName ? `: ${selectedVideoFileName}` : ""}`}
                  </span>
                </div>
              )}
              <button type="submit" className="upload-button" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload Video"}
              </button>
            </form>
            <p className="studio-tip">Demo tip: use a real CID for playable videos.</p>
            <div className="playlist-builder">
              <input
                type="text"
                placeholder="New playlist name"
                value={playlistName}
                onChange={(event) => setPlaylistName(event.target.value)}
              />
              <button type="button" className="secondary-button" onClick={createPlaylist}>
                Create Playlist
              </button>
              <button type="button" className="secondary-button" onClick={clearDrafts}>
                Clear Draft
              </button>
            </div>
          </div>

          <div className="sidebar-group">
            <div className="wallet-head">
              <h3>Wallet</h3>
              <button
                type="button"
                className="secondary-button small"
                onClick={() => setWalletPanelOpen((current) => !current)}
              >
                {walletPanelOpen ? "Hide" : "Open"}
              </button>
            </div>
            <div className={`wallet-panel ${walletPanelOpen ? "open" : ""}`}>
              <div className="wallet-status">
                <span>Status</span>
                <strong>
                  {!hasMetaMask ? "MetaMask not installed" : isWalletConnected ? "Connected" : "Not connected"}
                </strong>
              </div>
              <div className="wallet-status">
                <span>Address</span>
                <strong>
                  {!hasMetaMask ? "Install MetaMask first" : isWalletConnected ? formatAddress(account) : "Connect to continue"}
                </strong>
              </div>
              <div className="wallet-status">
                <span>Network</span>
                <strong>
                  {!hasMetaMask ? "MetaMask required" : chainId === localhostChainHex ? "Localhost 8545" : chainId || "Unknown"}
                </strong>
              </div>
              {!hasMetaMask && (
                <div className="wallet-warning">
                  Install MetaMask first, then create a new account or import an existing one.
                </div>
              )}
              {hasMetaMask && !isWalletConnected && (
                <div className="wallet-warning">
                  Use MetaMask to create a new account or import another wallet before connecting here.
                </div>
              )}
              {!isCorrectNetwork && (
                <div className="wallet-warning">
                  Wrong network selected. Switch to `Localhost 8545`.
                </div>
              )}
              <div className="wallet-actions">
                {!hasMetaMask && (
                  <a
                    className="wallet-link-button"
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Install MetaMask
                  </a>
                )}
                {!hasMetaMask && (
                  <a
                    className="wallet-link-button secondary"
                    href="https://support.metamask.io/configure/accounts/how-to-add-accounts-in-your-wallet/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Create / Import Account
                  </a>
                )}
                {!isWalletConnected && (
                  <button type="button" className="upload-button" onClick={connectWallet}>
                    Connect MetaMask
                  </button>
                )}
                {isWalletConnected && (
                  <button type="button" className="secondary-button" onClick={disconnectWallet}>
                    Disconnect
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={switchToLocalhost}>
                  Switch Network
                </button>
              </div>
            </div>
          </div>

          <div className="sidebar-group">
            <h3>Channel stats</h3>
            <div className="mini-stat">
              <span>Total videos</span>
              <strong>{videos.length}</strong>
            </div>
            <div className="mini-stat">
              <span>My videos</span>
              <strong>{channelVideos.length}</strong>
            </div>
            <div className="mini-stat">
              <span>Watch later</span>
              <strong>{watchLaterVideos.length}</strong>
            </div>
            <div className="mini-stat">
              <span>Network</span>
              <strong>{chainId === "0x7a69" ? "Localhost 8545" : chainId || "Unknown"}</strong>
            </div>
            <div className="mini-stat">
              <span>Engagement</span>
              <strong>{creatorAnalytics.engagement}</strong>
            </div>
            <div className="mini-stat">
              <span>Subscriptions</span>
              <strong>{subscriptions.length}</strong>
            </div>
            <div className="mini-stat">
              <span>Playlists</span>
              <strong>{playlists.length}</strong>
            </div>
            <div className="mini-stat">
              <span>Notifications</span>
              <strong>{notifications.length}</strong>
            </div>
          </div>

          <div className="sidebar-group">
            <div className="notification-head">
              <h3>Notifications</h3>
              <button type="button" className="secondary-button small" onClick={clearNotifications}>
                Clear
              </button>
            </div>
            <div className="notification-list">
              {notifications.length === 0 && <p className="queue-empty">No recent activity yet.</p>}
              {notifications.map((item) => (
                <div key={item.id} className="notification-item">
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="content">
          <div className="notice-bar">{banner}</div>

          <div className="toolbar-row">
            <div className="category-row">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`category-chip ${activeCategory === category ? "active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="sort-row">
              {sortOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`sort-chip ${sortMode === option ? "active" : ""}`}
                  onClick={() => setSortMode(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {selectedPage === "Home" && (
            <>
              {trendingVideos.length > 0 && (
                <section className="grid-section">
                  <div className="section-head">
                    <h2>Trending right now</h2>
                    <p>Videos ranked by views, likes, and comments.</p>
                  </div>
                  <div className="video-grid home-video-grid">
                    {trendingVideos.map((video) => (
                      renderVideoCard(video, {
                        keyPrefix: "trending",
                        badge: `#${video.id}`,
                        compact: true,
                        meta: `${video.views} views | ${video.likes} likes | ${video.commentCount} comments`
                      })
                    ))}
                  </div>
                </section>
              )}

              {historyVideos.length > 0 && (
                <section className="grid-section">
                  <div className="section-head">
                    <h2>Continue watching</h2>
                    <p>Your recent watch history is stored locally for quick demos.</p>
                  </div>
                  <div className="video-grid home-video-grid">
                    {historyVideos.slice(0, 4).map((video) => (
                      renderVideoCard(video, {
                        keyPrefix: "history",
                        compact: true
                      })
                    ))}
                  </div>
                </section>
              )}

              {continueWatchingVideos.length > 0 && (
                <section className="grid-section">
                  <div className="section-head">
                    <h2>Resume watching</h2>
                    <p>Playback progress is saved automatically in your browser.</p>
                  </div>
                  <div className="video-grid home-video-grid">
                    {continueWatchingVideos.map((item) => (
                      renderVideoCard(item.video, {
                        keyPrefix: "resume",
                        compact: true,
                        subtitle: getRelativeProgressLabel(item.seconds)
                      })
                    ))}
                  </div>
                </section>
              )}

              {subscribedVideos.length > 0 && (
                <section className="grid-section">
                  <div className="section-head">
                    <h2>From subscribed creators</h2>
                    <p>Quick access to channels you follow.</p>
                  </div>
                  <div className="video-grid home-video-grid">
                    {subscribedVideos.slice(0, 4).map((video) => (
                      renderVideoCard(video, {
                        keyPrefix: "subscribed",
                        compact: true
                      })
                    ))}
                  </div>
                </section>
              )}

              {playlistCards.length > 0 && (
                <section className="grid-section">
                  <div className="section-head">
                    <h2>Your playlists</h2>
                    <p>Custom collections saved locally for your demo.</p>
                  </div>
                  <div className="featured-grid">
                    {playlistCards.slice(0, 4).map((playlist) => (
                      <button
                        key={playlist.id}
                        type="button"
                        className="featured-tile compact"
                        onClick={() => setSelectedPage("Playlists")}
                      >
                        <span className="featured-rank">{playlist.videos.length} vids</span>
                        <strong>{playlist.name}</strong>
                        <small>{playlist.videos[0] ? playlist.videos[0].title : "Add videos from Watch page"}</small>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="dashboard-strip">
                <div className="section-head">
                  <h2>Creator dashboard</h2>
                  <p>Platform stats and engagement overview.</p>
                </div>
                <div className="hero-metrics dashboard-metrics">
                  <div className="metric-card">
                    <strong>{videos.length}</strong>
                    <span>Published videos</span>
                  </div>
                  <div className="metric-card">
                    <strong>{creatorAnalytics.totalViews}</strong>
                    <span>Total views</span>
                  </div>
                  <div className="metric-card">
                    <strong>{creatorAnalytics.totalLikes}</strong>
                    <span>Total likes</span>
                  </div>
                  <div className="metric-card">
                    <strong>{creatorAnalytics.totalComments}</strong>
                    <span>Comments</span>
                  </div>
                </div>
              </section>

              <section className="grid-section">
                <div className="section-head">
                  <h2>Recommended feed</h2>
                  <p>YouTube-style cards powered by blockchain video metadata.</p>
                </div>

                {loading && <div className="empty-panel">Loading videos from the blockchain...</div>}

                <div className="video-grid">
                  {filteredVideos.map((video) =>
                    renderVideoCard(video, {
                      keyPrefix: "recommended",
                      showActions: true
                    })
                  )}
                </div>
              </section>
            </>
          )}

          {selectedPage === "Watch" && (
            <section className="watch-layout">
              <div className="watch-panel">
                {!selectedVideo && <div className="empty-panel">Choose a video to start watching.</div>}

                {selectedVideo && (
                  <>
                    <video
                      key={`${selectedVideo.id}-${playbackUrl || getVideoUrl(selectedVideo.hash)}`}
                      className="featured-player"
                      controls
                      poster={getResolvedThumbnail(selectedVideo) || undefined}
                      onError={handleVideoPlaybackError}
                      onTimeUpdate={(event) => handlePlayerProgress(event, selectedVideo.id)}
                    >
                      <source src={playbackUrl || getVideoUrl(selectedVideo.hash)} type="video/mp4" />
                    </video>

                    <h1 className="featured-title">{selectedVideo.title}</h1>

                    <div className="featured-meta">
                      <div>
                        <strong>{selectedVideo.views} views</strong>
                        <span>{formatTimestamp(selectedVideo.createdAt)}</span>
                      </div>
                      <div className="featured-actions">
                        <button type="button" onClick={() => handleRecordView(selectedVideo)} disabled={recordingView}>
                          {recordingView ? "Recording..." : "Record View"}
                        </button>
                        <button type="button" onClick={handleToggleLike} disabled={liking}>
                          {liking ? "Updating..." : selectedVideo.likedByWallet ? `Unlike (${selectedVideo.likes})` : `Like (${selectedVideo.likes})`}
                        </button>
                        <button type="button" onClick={() => toggleWatchLater(selectedVideo.id)}>
                          {watchLaterIds.includes(selectedVideo.id) ? "Saved" : "Watch later"}
                        </button>
                        <button type="button" onClick={() => shareVideo(selectedVideo)}>
                          Share
                        </button>
                        <button type="button" onClick={() => handleDeleteVideo(selectedVideo)}>
                          Remove
                        </button>
                        <a href={getVideoUrl(selectedVideo.hash)} target="_blank" rel="noreferrer">
                          Open IPFS
                        </a>
                      </div>
                    </div>

                    <div className="watch-stats-grid">
                      <div className="metric-card">
                        <strong>{selectedVideo.likes}</strong>
                        <span>Likes</span>
                      </div>
                      <div className="metric-card">
                        <strong>{selectedVideo.commentCount}</strong>
                        <span>Comments</span>
                      </div>
                      <div className="metric-card">
                        <strong>{getCategory(selectedVideo)}</strong>
                        <span>Category</span>
                      </div>
                    </div>

                    <div className="channel-card">
                      <div>
                        <strong>{getDisplayName(selectedVideo.author)}</strong>
                        <span>{selectedVideo.commentCount} comments on this video</span>
                      </div>
                      <div className="channel-card-actions">
                        <button type="button" onClick={() => toggleSubscription(selectedVideo.author)}>
                          {subscriptions.includes(selectedVideo.author.toLowerCase()) ? "Subscribed" : "Subscribe"}
                        </button>
                        <button type="button" onClick={() => setSelectedPage("Channel")}>
                          View Channel
                        </button>
                      </div>
                    </div>

                    <div className="note-panel">
                      <div className="section-head compact">
                        <h2>Private notes</h2>
                        <p>Save your own presentation points for this video.</p>
                      </div>
                      <textarea
                        value={videoNotes[selectedVideo.id] || ""}
                        onChange={(event) => saveVideoNote(selectedVideo.id, event.target.value)}
                        placeholder="Write your personal note for this video..."
                      />
                    </div>

                    {playlistCards.length > 0 && (
                      <div className="playlist-strip">
                        <strong>Add to playlist</strong>
                        <div className="playlist-chip-row">
                          {playlistCards.map((playlist) => (
                            <button
                              key={playlist.id}
                              type="button"
                              className="sort-chip"
                              onClick={() => saveCurrentToPlaylist(playlist.id)}
                            >
                              {playlist.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <section className="comments-panel">
                      <h3>Comments</h3>

                      <form className="comment-form" onSubmit={handleAddComment}>
                        <input
                          type="text"
                          placeholder="Add a public comment"
                          value={commentInput}
                          onChange={(event) => setCommentInput(event.target.value)}
                        />
                        <button type="submit" disabled={commenting}>
                          {commenting ? "Posting..." : "Comment"}
                        </button>
                      </form>

                      <div className="comment-list">
                        {comments.length === 0 && (
                          <p className="queue-empty">No comments yet. Be the first to comment.</p>
                        )}

                        {comments.map((comment) => (
                          <article key={comment.id} className="comment-item">
                            <strong>{formatAddress(comment.author)}</strong>
                            <span>{formatTimestamp(comment.createdAt)}</span>
                            <p>{comment.text}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="queue-panel">
                <h2>Up next</h2>
                <div className="queue-list">
                  {filteredVideos.map((video) => (
                    <button
                      key={video.id}
                      type="button"
                      className={`queue-item ${selectedVideo && selectedVideo.id === video.id ? "active" : ""}`}
                      onClick={() => openVideo(video)}
                    >
                      <div
                        className="queue-thumb"
                        style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5)), url(${getResolvedThumbnail(video)})` }}
                      >
                        <span>{video.id}</span>
                      </div>
                      <div className="queue-copy">
                        <strong>{video.title}</strong>
                        <span>{formatAddress(video.author)}</span>
                        <small>{video.views} views | {video.likes} likes</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {selectedPage === "Channel" && (
            <section className="channel-page">
              <div className="channel-hero">
                <div>
                  <p className="channel-label">Creator channel</p>
                  <h2>{getDisplayName(account)}</h2>
                  <span>{channelVideos.length} uploaded videos | {creatorAnalytics.totalLikes} total likes</span>
                </div>
                <div className="channel-hero-actions">
                  <input
                    type="text"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Creator display name"
                  />
                  <button type="button" onClick={saveProfileName}>
                    Save Name
                  </button>
                  <button type="button" onClick={() => setSelectedPage("Home")}>
                    Back to Home
                  </button>
                </div>
              </div>

              <div className="analytics-grid">
                <div className="metric-card">
                  <strong>{creatorAnalytics.totalViews}</strong>
                  <span>Total views</span>
                </div>
                <div className="metric-card">
                  <strong>{creatorAnalytics.totalLikes}</strong>
                  <span>Total likes</span>
                </div>
                <div className="metric-card">
                  <strong>{creatorAnalytics.totalComments}</strong>
                  <span>Total comments</span>
                </div>
                <div className="metric-card">
                  <strong>{creatorAnalytics.engagement}</strong>
                  <span>Engagement score</span>
                </div>
              </div>

              <div className="video-grid">
                {channelVideos.map((video) => (
                  <article key={video.id} className="video-card">
                    <button
                      type="button"
                      className="video-card-preview"
                      onClick={() => openVideo(video)}
                    >
                      <div
                        className="video-card-thumb"
                        style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.6)), url(${getResolvedThumbnail(video)})` }}
                      >
                        <span>#{video.id}</span>
                      </div>
                    </button>

                    <div className="video-card-body">
                      <strong>{video.title}</strong>
                      <span>{video.views} views | {video.likes} likes</span>
                      <small>{video.commentCount} comments | {formatTimestamp(video.createdAt)}</small>
                      <div className="card-actions">
                        <button type="button" onClick={() => shareVideo(video)}>Share</button>
                        <button type="button" onClick={() => handleDeleteVideo(video)}>Remove</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {selectedPage === "Library" && (
            <section className="library-page">
              <div className="section-head">
                <h2>Your Library</h2>
                <p>Watch later and viewing history are saved locally for demo polish.</p>
              </div>

              <div className="library-grid">
                <div className="library-panel">
                  <h3>Watch later</h3>
                  {watchLaterVideos.length === 0 && (
                    <p className="queue-empty">Save videos from the watch page to build this list.</p>
                  )}
                  <div className="queue-list">
                    {watchLaterVideos.map((video) => (
                        <button
                          key={video.id}
                          type="button"
                          className="queue-item"
                          onClick={() => openVideo(video)}
                        >
                          <div
                            className="queue-thumb"
                            style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5)), url(${getResolvedThumbnail(video)})` }}
                          >
                            <span>{video.id}</span>
                          </div>
                        <div className="queue-copy">
                          <strong>{video.title}</strong>
                          <span>{formatAddress(video.author)}</span>
                          <small>{video.views} views | {video.likes} likes</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="library-panel">
                  <h3>Watch history</h3>
                  {historyVideos.length === 0 && (
                    <p className="queue-empty">Open a video from Home or Watch to populate history.</p>
                  )}
                  <div className="queue-list">
                    {historyVideos.map((video) => (
                        <button
                          key={video.id}
                          type="button"
                          className="queue-item"
                          onClick={() => openVideo(video)}
                        >
                          <div
                            className="queue-thumb"
                            style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5)), url(${getResolvedThumbnail(video)})` }}
                          >
                            <span>{video.id}</span>
                          </div>
                        <div className="queue-copy">
                          <strong>{video.title}</strong>
                          <span>{formatAddress(video.author)}</span>
                          <small>{formatTimestamp(video.createdAt)}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {selectedPage === "Playlists" && (
            <section className="library-page">
              <div className="section-head">
                <h2>Your Playlists</h2>
                <p>Create custom collections and open any saved video in one click.</p>
              </div>

              <div className="library-grid">
                {playlistCards.length === 0 && (
                  <div className="library-panel">
                    <h3>No playlists yet</h3>
                    <p className="queue-empty">Create one from the Studio panel, then add videos from the Watch page.</p>
                  </div>
                )}

                {playlistCards.map((playlist) => (
                  <div key={playlist.id} className="library-panel">
                    <h3>{playlist.name}</h3>
                    <p className="queue-empty">{playlist.videos.length} saved videos</p>
                    <div className="queue-list">
                      {playlist.videos.map((video) => (
                        <button
                          key={`${playlist.id}-${video.id}`}
                          type="button"
                          className="queue-item"
                          onClick={() => openVideo(video)}
                        >
                          <div
                            className="queue-thumb"
                            style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.5)), url(${getResolvedThumbnail(video)})` }}
                          >
                            <span>{video.id}</span>
                          </div>
                          <div className="queue-copy">
                            <strong>{video.title}</strong>
                            <span>{formatAddress(video.author)}</span>
                            <small>{video.views} views | {video.likes} likes</small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
