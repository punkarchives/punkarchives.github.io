// yes firebase api keys are meant to be public
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, push } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";

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

// Check if user is trusted (required for adding events)
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

// Format date for display
function formatEventDate(dateString, timeString) {
  const date = new Date(dateString + ' ' + timeString);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let statusText = '';
  let statusColor = '#aa0000';
  
  if (diffDays < 0) {
    // Past event
    if (diffDays >= -3) {
      statusText = `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
      statusColor = '#FF8C00';
    } else {
      return null; // Don't show events older than 3 days
    }
  } else if (diffDays === 0) {
    statusText = 'Today';
    statusColor = '#FF0000';
  } else if (diffDays === 1) {
    statusText = 'Tomorrow';
    statusColor = '#FF8C00';
  } else {
    statusText = `In ${diffDays} days`;
    statusColor = '#aa0000';
  }
  
  return {
    formatted: date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) + ' at ' + timeString,
    status: statusText,
    statusColor: statusColor
  };
}

// Load and display events
async function loadEvents() {
  try {
    const eventsRef = ref(db, 'events');
    const eventsSnapshot = await get(eventsRef);
    
    const eventsContainer = document.getElementById('events-list');
    
    if (!eventsSnapshot.exists()) {
      eventsContainer.innerHTML = '<p>No events found. Be the first to add one!</p>';
      return;
    }
    
    const allEvents = eventsSnapshot.val();
    const eventsArray = Object.entries(allEvents).map(([id, event]) => ({
      id,
      ...event
    }));
    
    // Filter and sort events
    const validEvents = [];
    eventsArray.forEach(event => {
      const dateInfo = formatEventDate(event.date, event.time);
      if (dateInfo) {
        validEvents.push({
          ...event,
          dateInfo
        });
      }
    });
    
    // Sort by date (upcoming first, then recent)
    validEvents.sort((a, b) => {
      const dateA = new Date(a.date + ' ' + a.time);
      const dateB = new Date(b.date + ' ' + b.time);
      return dateA - dateB;
    });
    
    if (validEvents.length === 0) {
      eventsContainer.innerHTML = '<p>No upcoming or recent events found.</p>';
      return;
    }
    
    // Display events
    let eventsHTML = '';
    validEvents.forEach(event => {
      const bandsList = event.bands.split('\n').filter(band => band.trim()).join(', ');
      
      eventsHTML += `
        <div style="border: 1px solid #aa0000; margin-bottom: 20px; padding: 15px; background-color: rgba(0,0,0,0.3);">
          <div style="display: flex; gap: 15px;">
            ${event.flyer ? `
              <div style="flex-shrink: 0;">
                <img src="${event.flyer}" alt="Event flyer" style="width: 150px; object-fit: cover; border: 1px solid #aa0000;">
              </div>
            ` : ''}
            <div style="flex: 1;">
              <h3 style="margin: 0 0 10px 0; color: #aa0000;">${event.dateInfo.formatted}</h3>
              <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location}</p>
              <p style="margin: 5px 0;"><strong>Bands:</strong> ${bandsList}</p>
              ${event.price ? `<p style="margin: 5px 0;"><strong>Price:</strong> ${event.price}</p>` : ''}
              <p style="margin: 5px 0; color: ${event.dateInfo.statusColor};"><strong>Status:</strong> ${event.dateInfo.status}</p>
              ${event.tickets ? `<p style="margin: 5px 0;"><strong>Tickets:</strong> <a href="${event.tickets}" target="_blank" style="color: #aa0000;">Purchase Here</a></p>` : ''}
              <p style="margin: 5px 0; font-size: 12px; color: #666;">Added by: ${event.addedBy}</p>
            </div>
          </div>
        </div>
      `;
    });
    
    eventsContainer.innerHTML = eventsHTML;
  } catch (error) {
    console.error('Error loading events:', error);
    document.getElementById('events-list').innerHTML = '<p>Error loading events.</p>';
  }
}

// Add new event
async function addEvent(eventData) {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert('You must be logged in to add events.');
      return false;
    }
    
    const isTrusted = await isUserTrusted();
    if (!isTrusted) {
      alert('You must be a trusted user to add events.');
      return false;
    }
    
    // Get current username
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
    
    // Create event object
    const event = {
      date: eventData.date,
      time: eventData.time,
      location: eventData.location,
      bands: eventData.bands,
      flyer: eventData.flyer || '',
      price: eventData.price || '',
      tickets: eventData.tickets || '',
      addedBy: properUsername,
      timestamp: new Date().toISOString()
    };
    
    // Save to Firebase
    const eventsRef = ref(db, 'events');
    await push(eventsRef, event);
    
    return true;
  } catch (error) {
    console.error('Error adding event:', error);
    return false;
  }
}

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  // Load events
  await loadEvents();
  
  // Check authentication and show/hide add event form
  onAuthStateChanged(auth, async (user) => {
    const addEventSection = document.getElementById('add-event-section');
    if (user) {
      const isTrusted = await isUserTrusted();
      if (isTrusted) {
        addEventSection.style.display = 'block';
      } else {
        addEventSection.style.display = 'none';
      }
    } else {
      addEventSection.style.display = 'none';
    }
  });
  
  // Handle form submission
  const addEventForm = document.getElementById('add-event-form');
  addEventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      date: document.getElementById('event-date').value,
      time: document.getElementById('event-time').value,
      location: document.getElementById('event-location').value,
      bands: document.getElementById('event-bands').value,
      flyer: document.getElementById('event-flyer').value,
      price: document.getElementById('event-price').value,
      tickets: document.getElementById('event-tickets').value
    };
    
    // Validate form
    if (!formData.date || !formData.time || !formData.location || !formData.bands) {
      alert('Please fill in all required fields.');
      return;
    }
    
    // Check if event is in the future or within 3 days of past
    const eventDate = new Date(formData.date + ' ' + formData.time);
    const now = new Date();
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < -3) {
      alert('Events must be upcoming or within 3 days of the past date.');
      return;
    }
    
    // Add event
    const success = await addEvent(formData);
    if (success) {
      alert('Event added successfully!');
      addEventForm.reset();
      await loadEvents(); // Reload events
    } else {
      alert('Failed to add event. Please try again.');
    }
  });
});
