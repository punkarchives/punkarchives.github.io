// Discogs Import functionality for Punk Archives
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, get, set, child } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoKv4PLrk4xvZF_IeUhfViwOLBYBv0czQ",
  authDomain: "punkarchivesdata.firebaseapp.com",
  projectId: "punkarchivesdata",
  storageBucket: "punkarchivesdata.firebasestorage.app",
  messagingSenderId: "272312472875",
  appId: "1:272312472875:web:048288b995db157dc8216e",
  measurementId: "G-24V1CEFHYP",
  databaseURL: "https://punkarchivesdata-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Discogs API configuration
const DISCOGS_API_URL = 'https://api.discogs.com';
const DISCOGS_USER_AGENT = 'PunkArchives/1.0';

// Check if user is trusted (required for importing)
async function isUserTrusted() {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const lowercaseUsername = user.email.replace("@punkarchives.com", "").toLowerCase();
    
    // Find the proper capitalized username from database
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    let properUsername = lowercaseUsername; // fallback
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const userEntry = Object.entries(users).find(([key, data]) => data.userId === user.uid);
      if (userEntry) {
        properUsername = userEntry[0]; // This is the properly capitalized username
      }
    }
    
    const possiblePaths = [
      `users/${user.uid}`,
      `users/${properUsername}`,
      `users/${lowercaseUsername}`,
      `users/nxdx`
    ];
    
    for (const path of possiblePaths) {
      const userRef = ref(db, path);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        return userData.trusted === "true";
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking trusted status:", error);
    return false;
  }
}

// Extract release ID from Discogs URL
function extractDiscogsReleaseId(url) {
  try {
    // Handle different Discogs URL formats
    const patterns = [
      /discogs\.com\/release\/(\d+)/,
      /discogs\.com\/.*\/release\/(\d+)/,
      /discogs\.com\/.*\/master\/(\d+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // If it's just a number, assume it's a release ID
    if (/^\d+$/.test(url.trim())) {
      return url.trim();
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting Discogs ID:", error);
    return null;
  }
}

// Fetch release data from Discogs API
async function fetchDiscogsRelease(releaseId) {
  try {
    const response = await fetch(`${DISCOGS_API_URL}/releases/${releaseId}`, {
      headers: {
        'User-Agent': DISCOGS_USER_AGENT
      }
    });
    
    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching from Discogs:", error);
    throw error;
  }
}

// Map Discogs data to Punk Archives format
function mapDiscogsToPunkArchives(discogsData) {
  try {
    // Extract basic release info
    const release = {
      title: discogsData.title || '',
      cover_image: discogsData.images?.[0]?.uri || '',
      year: discogsData.year?.toString() || '',
      release_type: mapReleaseType(discogsData.formats),
      physical_format: mapPhysicalFormat(discogsData.formats),
      limitation: extractLimitation(discogsData.formats),
      extra_info: extractExtraInfo(discogsData.formats),
      tracks: extractTracks(discogsData.tracklist),
      label: extractLabel(discogsData.labels),
      listen: extractStreamingLinks(discogsData)
    };
    
    return release;
  } catch (error) {
    console.error("Error mapping Discogs data:", error);
    throw error;
  }
}

// Map Discogs release types to Punk Archives format
function mapReleaseType(formats) {
  if (!formats || formats.length === 0) return '';
  
  const format = formats[0];
  const type = format.type?.toLowerCase() || '';
  
  if (type.includes('album') || type.includes('lp')) return 'Album';
  if (type.includes('ep')) return 'EP';
  if (type.includes('single')) return 'Single';
  if (type.includes('split')) return 'Split';
  if (type.includes('compilation')) return 'Compilation';
  if (type.includes('demo')) return 'Demo';
  if (type.includes('live')) return 'Live';
  
  return 'Album'; // Default
}

// Map physical format
function mapPhysicalFormat(formats) {
  if (!formats || formats.length === 0) return '';
  
  const format = formats[0];
  const descriptions = format.descriptions || [];
  
  let formatStr = '';
  
  // Add format type
  if (format.type) {
    formatStr += format.type;
  }
  
  // Add basic format descriptions to format field
  descriptions.forEach(desc => {
    if (desc.toLowerCase().includes('inch') || 
        desc.toLowerCase().includes('rpm') ||
        desc.toLowerCase().includes('cd') ||
        desc.toLowerCase().includes('cassette') ||
        desc.toLowerCase().includes('tape')) {
      formatStr += ` ${desc}`;
    }
  });
  
  return formatStr.trim() || 'Unknown';
}

// Extract limitation info
function extractLimitation(formats) {
  if (!formats || formats.length === 0) return '';
  
  const format = formats[0];
  const descriptions = format.descriptions || [];
  
  for (const desc of descriptions) {
    if (desc.toLowerCase().includes('copies') || 
        desc.toLowerCase().includes('limited') ||
        desc.toLowerCase().includes('edition')) {
      return desc;
    }
  }
  
  return '';
}

// Extract extra info - now captures special format features
function extractExtraInfo(formats) {
  if (!formats || formats.length === 0) return '';
  
  const format = formats[0];
  const descriptions = format.descriptions || [];
  
  // Capture special format features for extra info
  const specialFeatures = descriptions.filter(desc => 
    desc.toLowerCase().includes('colored') ||
    desc.toLowerCase().includes('picture') ||
    desc.toLowerCase().includes('gatefold') ||
    desc.toLowerCase().includes('foldout') ||
    desc.toLowerCase().includes('insert') ||
    desc.toLowerCase().includes('poster') ||
    desc.toLowerCase().includes('sticker') ||
    desc.toLowerCase().includes('numbered') ||
    desc.toLowerCase().includes('handmade') ||
    desc.toLowerCase().includes('test') ||
    desc.toLowerCase().includes('promo') ||
    desc.toLowerCase().includes('white') ||
    desc.toLowerCase().includes('black') ||
    desc.toLowerCase().includes('transparent') ||
    desc.toLowerCase().includes('splatter') ||
    desc.toLowerCase().includes('marble') ||
    desc.toLowerCase().includes('swirl')
  );
  
  return specialFeatures.join(', ');
}

// Extract tracks
function extractTracks(tracklist) {
  if (!tracklist || tracklist.length === 0) return [];
  
  return tracklist.map(track => track.title || '').filter(title => title);
}

// Extract label info
function extractLabel(labels) {
  if (!labels || labels.length === 0) return '';
  
  return labels[0].name || '';
}

// Extract streaming links (if available)
function extractStreamingLinks(discogsData) {
  // This would need to be enhanced with actual streaming service data
  // For now, return empty string
  return '';
}

// Update release in Firebase
async function updateReleaseInFirebase(bandName, releaseTitle, newData) {
  try {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'bands'));
    
    if (!snapshot.exists()) {
      throw new Error('Bands data not found');
    }
    
    const bandsRaw = snapshot.val();
    const bands = Object.entries(bandsRaw).map(([key, val]) => ({ key, ...val }));
    const band = bands.find(b => b.band_name === bandName);
    
    if (!band) {
      throw new Error('Band not found');
    }
    
    // Find the specific release
    const releaseIndex = band.releases?.findIndex(r => r.title === releaseTitle);
    
    if (releaseIndex === -1) {
      throw new Error('Release not found');
    }
    
    // Update the release data
    const updatedReleases = [...band.releases];
    updatedReleases[releaseIndex] = { ...updatedReleases[releaseIndex], ...newData };
    
    // Update in Firebase
    await set(ref(db, `bands/${band.key}/releases`), updatedReleases);
    
    return true;
  } catch (error) {
    console.error("Error updating release in Firebase:", error);
    throw error;
  }
}

// Main import function
async function importFromDiscogs(discogsUrl) {
  try {
    // Check if user is trusted
    const isTrusted = await isUserTrusted();
    if (!isTrusted) {
      throw new Error('You must be a trusted user to import data from Discogs');
    }
    
    // Extract release ID
    const releaseId = extractDiscogsReleaseId(discogsUrl);
    if (!releaseId) {
      throw new Error('Invalid Discogs URL. Please provide a valid Discogs release URL or ID.');
    }
    
    // Fetch data from Discogs
    const discogsData = await fetchDiscogsRelease(releaseId);
    
    // Map to Punk Archives format
    const mappedData = mapDiscogsToPunkArchives(discogsData);
    
    return mappedData;
  } catch (error) {
    console.error("Import error:", error);
    throw error;
  }
}

// Export functions for use in other scripts
window.discogsImport = {
  importFromDiscogs,
  updateReleaseInFirebase,
  isUserTrusted
};
