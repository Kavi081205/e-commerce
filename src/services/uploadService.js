/**
 * Reusable Image Upload Service for Cloudinary.
 * Features:
 *  - File validations (size, type)
 *  - Vite environment variable loading with defaults
 *  - Step-by-step console logging (useful for debugging CORS/Network/API issues)
 *  - Timeout control using AbortController
 *  - Transient error retries (exponential backoff)
 *  - Detailed error extraction (parses JSON response from Cloudinary)
 */

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Default fallbacks in case env variables aren't defined in some environments
const FALLBACK_CLOUD_NAME = "doca4zvcx";
const FALLBACK_UPLOAD_PRESET = "smkp_upload";

/**
 * Uploads a file to Cloudinary with retry support, timeout, validation, and detailed logging.
 *
 * @param {File} file - The file object to upload
 * @param {object} options - Optional configuration options
 * @param {number} options.maxRetries - Maximum number of retries for transient errors (default: 3)
 * @param {number} options.timeoutMs - Request timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} Secure URL of the uploaded image
 */
export const uploadImage = async (file, options = {}) => {
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 30000;

  console.group("Cloudinary Upload Process");
  
  // 1. File validation
  if (!file) {
    const err = new Error("No file selected for upload.");
    console.error("Upload Error: No file provided.", err);
    console.groupEnd();
    throw err;
  }

  console.log("Selected File Details:", {
    name: file.name,
    type: file.type,
    sizeBytes: file.size,
    sizeMB: (file.size / (1024 * 1024)).toFixed(2)
  });

  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    const err = new Error(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
    console.error(`Upload Error: File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit.`, err);
    console.groupEnd();
    throw err;
  }

  if (!file.type.startsWith("image/")) {
    const err = new Error("Invalid file type. Only image files are allowed.");
    console.error(`Upload Error: File type '${file.type}' is not supported.`, err);
    console.groupEnd();
    throw err;
  }

  // 2. Load and verify configuration
  const cloudName = CLOUDINARY_CLOUD_NAME || FALLBACK_CLOUD_NAME;
  const uploadPreset = CLOUDINARY_UPLOAD_PRESET || FALLBACK_UPLOAD_PRESET;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    console.warn("Cloudinary environment variables missing. Falling back to default hardcoded configurations.", {
      VITE_CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD_NAME ? "Loaded" : "Missing (using fallback)",
      VITE_CLOUDINARY_UPLOAD_PRESET: CLOUDINARY_UPLOAD_PRESET ? "Loaded" : "Missing (using fallback)"
    });
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  console.log("Upload Configuration:", {
    uploadUrl,
    uploadPreset,
    isFallbackUsed: (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET)
  });

  // 3. Prepare FormData
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  console.log("FormData constructed. Keys present:", Array.from(formData.keys()));

  // 4. Request execution with retry logic
  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const isRetry = attempt > 1;
    console.log(`Request Start: Attempt ${attempt} of ${maxRetries + 1} ${isRetry ? "(Retry)" : ""}`);

    // Create abort controller for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const startTime = performance.now();
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const durationMs = (endTime - startTime).toFixed(2);
      console.log(`Response received in ${durationMs}ms. Status: ${res.status} ${res.statusText}`);

      if (!res.ok) {
        let errorData = null;
        let responseText = "";
        try {
          responseText = await res.text();
          errorData = JSON.parse(responseText);
        } catch (parseErr) {
          // Response body is not JSON or could not be read
        }

        console.error("Cloudinary upload API returned an error response:", {
          status: res.status,
          statusText: res.statusText,
          responseBody: errorData || responseText
        });

        // Parse detailed backend/API errors
        let apiErrorMessage = `Cloudinary returned status ${res.status}`;
        if (errorData && errorData.error && errorData.error.message) {
          apiErrorMessage = errorData.error.message;
        } else if (responseText) {
          apiErrorMessage = responseText;
        }

        // Handle specific Cloudinary HTTP errors to give actionable advice
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Unauthorized upload. Please check your credentials or upload preset. Details: ${apiErrorMessage}`);
        } else if (res.status === 400 && apiErrorMessage.includes("Upload preset")) {
          throw new Error(`Invalid or expired upload preset configurations. Details: ${apiErrorMessage}`);
        } else if (res.status === 400 && apiErrorMessage.includes("Invalid cloud name")) {
          throw new Error(`Invalid cloud name specified. Details: ${apiErrorMessage}`);
        } else {
          throw new Error(`Cloudinary upload failed: ${apiErrorMessage}`);
        }
      }

      const data = await res.json();
      console.log("Upload Success! Secure URL:", data.secure_url);
      console.groupEnd();
      return data.secure_url;

    } catch (err) {
      clearTimeout(timeoutId);

      // Distinguish error categories (timeout, network/CORS, other)
      let finalError = err;
      if (err.name === 'AbortError') {
        finalError = new Error(`Request timed out after ${timeoutMs / 1000} seconds.`);
      } else if (err instanceof TypeError && err.message === "Failed to fetch") {
        console.error("CORS, Content-Security-Policy (CSP) or Network Error detected during fetch!");
        console.error("Please verify that your connection is online, and that https://api.cloudinary.com is permitted in your Content Security Policy (connect-src directive).");
        finalError = new Error("Failed to upload image. This is likely due to a Network/CORS policy block. Check your internet connection or Vercel CSP configuration in vercel.json.", { cause: err });
      }

      console.error(`Attempt ${attempt} failed with error:`, {
        message: finalError.message,
        stack: finalError.stack,
        cause: finalError.cause
      });

      // Decide whether to retry or fail immediately.
      // We only retry transient errors (network connection/CSP failures or timeouts).
      const isTransientError = err.name === 'AbortError' || (err instanceof TypeError && err.message === "Failed to fetch") || (err.status >= 500);
      if (isTransientError && attempt <= maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`Transient issue encountered. Retrying attempt in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        console.groupEnd();
        throw finalError;
      }
    }
  }
};

/**
 * Uploads a video file directly to Cloudinary's video endpoint.
 * Supports MP4, MOV, and WEBM formats up to 100 MB.
 * Returns the secure_url string to save in Firestore as product.video.
 *
 * @param {File} file - The video file to upload
 * @param {object} options
 * @param {number} options.timeoutMs - Request timeout in ms (default: 120000 — 2 min for large videos)
 * @returns {Promise<string>} Cloudinary secure_url
 */
export const uploadVideo = async (file, options = {}) => {
  const timeoutMs = options.timeoutMs ?? 120000; // 2-minute timeout for large videos

  console.group("Cloudinary Video Upload");

  // 1. File presence check
  if (!file) {
    const err = new Error("No video file selected.");
    console.error("Video Upload Error:", err.message);
    console.groupEnd();
    throw err;
  }

  console.log("Video File Details:", {
    name: file.name,
    type: file.type,
    sizeBytes: file.size,
    sizeMB: (file.size / (1024 * 1024)).toFixed(2)
  });

  // 2. Size validation — 100 MB max
  const MAX_VIDEO_SIZE_MB = 100;
  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    const err = new Error(`Video file is too large. Maximum allowed size is ${MAX_VIDEO_SIZE_MB} MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`);
    console.error("Video Upload Error:", err.message);
    console.groupEnd();
    throw err;
  }

  // 3. Format validation — MP4, MOV, WEBM only
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
  const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".webm"];
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const isValidType = ALLOWED_VIDEO_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
  if (!isValidType) {
    const err = new Error(`Unsupported video format. Please upload an MP4, MOV, or WEBM file. Got: ${file.type || ext}`);
    console.error("Video Upload Error:", err.message);
    console.groupEnd();
    throw err;
  }

  // 4. Build Cloudinary endpoint — /video/upload
  const cloudName = CLOUDINARY_CLOUD_NAME || FALLBACK_CLOUD_NAME;
  const uploadPreset = CLOUDINARY_UPLOAD_PRESET || FALLBACK_UPLOAD_PRESET;
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  console.log("Video Upload Configuration:", { uploadUrl, uploadPreset });

  // 5. Prepare FormData
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  // 6. Single-attempt upload (no retry — videos are large, retrying wastes bandwidth)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log("Starting video upload to Cloudinary...");
    const startTime = performance.now();

    const res = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const durationMs = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`Video upload response received in ${durationMs}s. Status: ${res.status}`);

    if (!res.ok) {
      let errorData = null;
      let responseText = "";
      try {
        responseText = await res.text();
        errorData = JSON.parse(responseText);
      } catch (_) { /* ignore */ }

      const apiMsg = errorData?.error?.message || responseText || `HTTP ${res.status}`;
      console.error("Cloudinary video upload failed:", apiMsg);

      if (res.status === 401 || res.status === 403) {
        throw new Error(`Unauthorized. Check your Cloudinary upload preset allows video uploads. Details: ${apiMsg}`);
      }
      throw new Error(`Video upload failed: ${apiMsg}`);
    }

    const data = await res.json();
    console.log("Video Upload Success! secure_url:", data.secure_url);
    console.groupEnd();
    return data.secure_url;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Video upload timed out after ${timeoutMs / 1000} seconds. Try a smaller file or check your connection.`);
      console.error("Video Upload Error:", timeoutErr.message);
      console.groupEnd();
      throw timeoutErr;
    }
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      const netErr = new Error("Network error during video upload. Check your internet connection.");
      console.error("Video Upload Error:", netErr.message);
      console.groupEnd();
      throw netErr;
    }
    console.error("Video Upload Error:", err.message);
    console.groupEnd();
    throw err;
  }
};
