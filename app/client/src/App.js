import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import ItemList from './components/ItemList';
import ItemForm from './components/ItemForm';
import axios from 'axios';
import ColorThief from 'color-thief-browser';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditButtons, setShowEditButtons] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("https://cdn.midjourney.com/11cffed4-8a58-41de-98ff-d0cbd01cc75a/0_2.png");
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [dominantColor, setDominantColor] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [password, setPassword] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const imageRef = useRef();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchItems();
      fetchBanner();
      fetchConfig();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Apply the dominant color to document.body as a CSS variable
    if (dominantColor) {
      const [r, g, b] = dominantColor;
      
      // Convert RGB to HSL to manipulate saturation and lightness
      const rgbToHsl = (r, g, b) => {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
          h = s = 0; // achromatic
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0;
          }
          
          h /= 6;
        }
        
        return [h, s, l];
      };
      
      // Convert HSL back to RGB
      const hslToRgb = (h, s, l) => {
        let r, g, b;
        
        if (s === 0) {
          r = g = b = l; // achromatic
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      };
      
      // Get HSL values
      const [h, s, l] = rgbToHsl(r, g, b);
      
      // Create a darker and more saturated version of the color
      // Increase saturation by 20% but cap at 90%
      const newSaturation = Math.min(s + 0.2, 0.9);
      // Set lightness to 10% for a darker shade
      const newLightness = 0.05;
      
      // Convert back to RGB
      const [newR, newG, newB] = hslToRgb(h, newSaturation, newLightness);
      
      // Apply the color as background
      const darkShade = `rgb(${newR}, ${newG}, ${newB})`;
      document.documentElement.style.setProperty('--bg-color', darkShade);
    }
  }, [dominantColor]);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/check-auth', { withCredentials: true });
      setIsAuthenticated(response.data.authenticated);
      setShowLogin(!response.data.authenticated);
    } catch (err) {
      console.error('Error checking auth:', err);
      setIsAuthenticated(false);
      setShowLogin(true);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/login', { password }, { withCredentials: true });
      if (response.data.message === "Login successful") {
        setIsAuthenticated(true);
        setShowLogin(false);
        setPassword('');
      }
    } catch (err) {
      setError('Invalid password');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      setIsAuthenticated(false);
      setShowLogin(true);
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const fetchBanner = async () => {
    try {
      const response = await axios.get('/api/banner');
      if (response.data && response.data.bannerUrl) {
        setBannerUrl(response.data.bannerUrl);
      }
    } catch (err) {
      console.error('Error fetching banner:', err);
      // Using default banner, no need to show error to user
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await axios.get('/api/config');
      if (response.data) {
        // Apply page title
        if (response.data.pageTitle) {
          document.title = response.data.pageTitle;
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err);
      // Using default config, no need to show error to user
    }
  };

  // Extract dominant color from the loaded image
  const extractDominantColor = () => {
    if (imageRef.current && imageRef.current.complete) {
      try {
        // Create an off-screen canvas for image processing to avoid CORS issues
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageRef.current.naturalWidth || imageRef.current.width;
        canvas.height = imageRef.current.naturalHeight || imageRef.current.height;
        ctx.drawImage(imageRef.current, 0, 0);
        
        // Get image data from canvas
        let imageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
          console.error('CORS issue with image:', e);
          // Fall back to a less accurate method using ColorThief
          try {
            const colorThief = new ColorThief();
            const color = colorThief.getColor(imageRef.current);
            setDominantColor(color);
          } catch (colorThiefError) {
            console.error('ColorThief also failed:', colorThiefError);
            setDominantColor([15, 15, 15]); // Fallback to dark gray
          }
          return;
        }
        
        // Process image data to find dominant color
        const data = imageData.data;
        const colorCounts = {};
        
        // Sample pixels more thoroughly for a better representation
        const sampleInterval = Math.max(1, Math.floor(Math.sqrt(data.length / 4) / 100)); // Adaptive sampling
        
        for (let i = 0; i < data.length; i += 4 * sampleInterval) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          // Skip transparent or nearly transparent pixels
          if (a < 200) continue;
          
          // Skip very light or white pixels (potential background)
          const brightness = (r + g + b) / 3;
          if (brightness > 240) continue;
          
          // Skip near-black pixels (often just shadows/borders)
          if (brightness < 15) continue;
          
          // Group similar colors by rounding to reduce precision
          const roundFactor = 24; // Larger factor groups more colors together
          const rKey = Math.round(r / roundFactor) * roundFactor;
          const gKey = Math.round(g / roundFactor) * roundFactor;
          const bKey = Math.round(b / roundFactor) * roundFactor;
          
          const key = `${rKey},${gKey},${bKey}`;
          
          if (!colorCounts[key]) {
            colorCounts[key] = {
              count: 0,
              r: 0,
              g: 0,
              b: 0
            };
          }
          
          colorCounts[key].count++;
          colorCounts[key].r += r;
          colorCounts[key].g += g;
          colorCounts[key].b += b;
        }
        
        // Find the most common colors and get their average values
        const colorEntries = Object.entries(colorCounts)
          .map(([key, value]) => ({
            key,
            count: value.count,
            r: Math.round(value.r / value.count),
            g: Math.round(value.g / value.count),
            b: Math.round(value.b / value.count)
          }))
          .sort((a, b) => b.count - a.count);
        
        // Get the most dominant color, excluding whites and near-blacks
        const dominantColor = colorEntries.length > 0 
          ? [colorEntries[0].r, colorEntries[0].g, colorEntries[0].b]
          : [15, 15, 15]; // Fallback to dark gray if no good color is found
        
        // Get the second most dominant color for variety if available
        const secondColor = colorEntries.length > 1
          ? [colorEntries[1].r, colorEntries[1].g, colorEntries[1].b]
          : dominantColor;
        
        // Choose the more saturated of the two
        const saturation1 = getColorSaturation(dominantColor);
        const saturation2 = getColorSaturation(secondColor);
        
        setDominantColor(saturation1 > saturation2 ? dominantColor : secondColor);
      } catch (error) {
        console.error('Error extracting color:', error);
        // Fallback to a dark color
        setDominantColor([15, 15, 15]);
      }
    }
  };
  
  // Calculate color saturation (0-1)
  const getColorSaturation = ([r, g, b]) => {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    
    if (max === min) {
      return 0;
    }
    
    const d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  };

  const toggleEditMode = () => {
    setShowEditButtons(!showEditButtons);
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/items', { withCredentials: true });
      setItems(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to fetch items. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (newItem) => {
    try {
      const response = await axios.post('/api/items', newItem, { withCredentials: true });
      setItems([...items, response.data]);
    } catch (err) {
      console.error('Error adding item:', err);
      setError('Failed to add item. Please try again.');
    }
  };

  const updateItem = async (updatedItem) => {
    try {
      await axios.put(`/api/items/${updatedItem.id}`, updatedItem, { withCredentials: true });
      setItems(items.map(item => 
        item.id === updatedItem.id ? updatedItem : item
      ));
    } catch (err) {
      console.error('Error updating item:', err);
      setError('Failed to update item. Please try again.');
    }
  };

  const deleteItem = async (id) => {
    try {
      await axios.delete(`/api/items/${id}`, { withCredentials: true });
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      console.error('Error deleting item:', err);
      setError('Failed to delete item. Please try again.');
    }
  };

  const updateBannerUrl = async (url) => {
    try {
      setBannerLoaded(false); // Reset loaded state for new image
      await axios.post('/api/banner', { bannerUrl: url }, { withCredentials: true });
      setBannerUrl(url);
    } catch (err) {
      console.error('Error updating banner:', err);
      setError('Failed to update banner. Please try again.');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="terminal-app">
        <div className="terminal-container">
          <div className="terminal-loading">
            {'>'}  Loading...
          </div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="terminal-app">
        <div className="terminal-container">
          <div className="terminal-login">
            <form onSubmit={handleLogin} className="terminal-form">
              <div className="terminal-input-group">
                <span className="terminal-prompt">{'>'}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="terminal-input"
                  autoFocus
                />
              </div>
              {error && (
                <div className="terminal-error">
                  {'>'}  ERROR: {error}
                </div>
              )}
              <button type="submit" className="terminal-btn">
                {'>'}  Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-app">
      <div className="terminal-container">
        <div className="banner">
          <img 
            ref={imageRef}
            src={bannerUrl} 
            alt="Banner" 
            className={`banner-image ${bannerLoaded ? 'loaded' : ''}`}
            style={{ borderRadius: '12px' }}
            onLoad={() => {
              setBannerLoaded(true);
              setTimeout(extractDominantColor, 100);
            }}
            onError={(e) => {
              e.target.src = "https://cdn.midjourney.com/11cffed4-8a58-41de-98ff-d0cbd01cc75a/0_2.png";
              setError("Banner image failed to load. Using default banner.");
              setBannerLoaded(true);
            }}
            crossOrigin="anonymous"
          />
          {dominantColor && (
            <div 
              className="color-indicator" 
              style={{ 
                backgroundColor: `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`,
                border: '2px solid rgba(255, 255, 255, 0.5)',
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                zIndex: 10,
                boxShadow: '0 0 5px rgba(0, 0, 0, 0.5)'
              }}
              title={`Dominant color: RGB(${dominantColor.join(', ')})`}
            />
          )}
        </div>
        {error && (
          <div className="terminal-error">
            {'>'}  ERROR: {error}
          </div>
        )}
        
        {loading ? (
          <div className="terminal-loading">
            {'>'}  Loading...
          </div>
        ) : (
          <ItemList 
            items={items} 
            onUpdateItem={updateItem} 
            onDeleteItem={deleteItem}
            showEditButtons={showEditButtons}
          />
        )}
        
        <ItemForm 
          onAddItem={addItem} 
          showEditButtons={showEditButtons}
          toggleEditMode={toggleEditMode}
          bannerUrl={bannerUrl}
          updateBannerUrl={updateBannerUrl}
        />
        <div className="terminal-controls">
          <button onClick={handleLogout} className="terminal-btn terminal-logout-btn" title="Logout">
            {'>'} Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default App; 