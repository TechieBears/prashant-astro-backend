# React.js WebSocket Implementation Guide

This guide provides sample code for implementing WebSocket functionality in your React.js frontend.

## Prerequisites

Install Socket.IO client library:
```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

## Implementation

### 1. Socket.IO Configuration File

Create `src/config/socket.js`:

```javascript
import { io } from 'socket.io-client';

// Get the backend URL from environment variables
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Create and export the socket instance
export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

export default socket;
```

### 2. Custom Hook for Call Astrologers Updates

Create `src/hooks/useCallAstrologersSocket.js`:

```javascript
import { useEffect, useState, useCallback } from 'react';
import socket from '../config/socket';

/**
 * Custom hook to manage WebSocket connection for call astrologers updates
 * @param {Function} onUpdate - Callback function called when update is received
 * @param {boolean} enabled - Whether to enable the socket connection (default: true)
 * @returns {Object} - Connection status and control functions
 */
export const useCallAstrologersSocket = (onUpdate, enabled = true) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Subscribe to call astrologers updates
  const subscribe = useCallback(() => {
    if (socket.connected && !isSubscribed) {
      socket.emit('subscribe:call-astrologers');
      setIsSubscribed(true);
      console.log('📡 Subscribed to call-astrologers updates');
    }
  }, [isSubscribed]);

  // Unsubscribe from call astrologers updates
  const unsubscribe = useCallback(() => {
    if (socket.connected && isSubscribed) {
      socket.emit('unsubscribe:call-astrologers');
      setIsSubscribed(false);
      console.log('📡 Unsubscribed from call-astrologers updates');
    }
  }, [isSubscribed]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Handle connection
    const onConnect = () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      // Auto-subscribe on connect
      subscribe();
    };

    // Handle disconnection
    const onDisconnect = () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
      setIsSubscribed(false);
    };

    // Handle call astrologers updates
    const onCallAstrologersUpdate = (data) => {
      console.log('📥 Received call-astrologers update:', data);
      if (onUpdate && typeof onUpdate === 'function') {
        onUpdate(data);
      }
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('call-astrologers:updated', onCallAstrologersUpdate);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true);
      subscribe();
    }

    // Cleanup on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('call-astrologers:updated', onCallAstrologersUpdate);
      unsubscribe();
    };
  }, [enabled, onUpdate, subscribe, unsubscribe]);

  return {
    isConnected,
    isSubscribed,
    subscribe,
    unsubscribe,
  };
};
```

### 3. Component Example - Call Astrologers List

Create `src/components/CallAstrologersList.js`:

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { useCallAstrologersSocket } from '../hooks/useCallAstrologersSocket';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const CallAstrologersList = () => {
  const [astrologers, setAstrologers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
  });

  // Fetch call astrologers from API
  const fetchCallAstrologers = useCallback(async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${API_URL}/api/call/public/get-all-call-astrologers`,
        {
          params: {
            page,
            limit,
          },
        }
      );

      if (response.data.success) {
        setAstrologers(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching call astrologers:', err);
      setError(err.response?.data?.message || 'Failed to fetch call astrologers');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle WebSocket update
  const handleUpdate = useCallback(
    (updateData) => {
      console.log('🔄 Updating astrologers list due to WebSocket event:', updateData);

      // Option 1: Re-fetch the entire list (recommended for accuracy)
      fetchCallAstrologers(pagination.currentPage, pagination.limit);

      // Option 2: Update specific astrologer in the list (more efficient)
      // setAstrologers((prevAstrologers) =>
      //   prevAstrologers.map((astrologer) =>
      //     astrologer._id === updateData.userId
      //       ? {
      //           ...astrologer,
      //           profile: {
      //             ...astrologer.profile,
      //             isBusy: updateData.isBusy,
      //           },
      //         }
      //       : astrologer
      //   )
      // );
    },
    [fetchCallAstrologers, pagination]
  );

  // Initialize WebSocket connection
  const { isConnected, isSubscribed } = useCallAstrologersSocket(handleUpdate);

  // Fetch initial data
  useEffect(() => {
    fetchCallAstrologers(1, 10);
  }, [fetchCallAstrologers]);

  // Handle pagination
  const handlePageChange = (newPage) => {
    fetchCallAstrologers(newPage, pagination.limit);
  };

  if (loading && astrologers.length === 0) {
    return <div>Loading call astrologers...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="call-astrologers-list">
      {/* WebSocket Status Indicator */}
      <div className="socket-status" style={{ marginBottom: '1rem' }}>
        <span
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            backgroundColor: isConnected ? '#4caf50' : '#f44336',
            color: 'white',
            fontSize: '0.875rem',
          }}
        >
          {isConnected
            ? `🟢 Connected${isSubscribed ? ' & Subscribed' : ''}`
            : '🔴 Disconnected'}
        </span>
      </div>

      {/* Astrologers List */}
      <h2>Call Astrologers</h2>
      <div className="astrologers-grid">
        {astrologers.map((astrologer) => (
          <div
            key={astrologer._id}
            className="astrologer-card"
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div className="astrologer-header">
              <h3>
                {astrologer.profile?.fullName || 'Unknown Astrologer'}
              </h3>
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  backgroundColor: astrologer.profile?.isBusy ? '#ff9800' : '#4caf50',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                }}
              >
                {astrologer.profile?.isBusy ? '🔴 Busy' : '🟢 Available'}
              </span>
            </div>
            <p>{astrologer.profile?.about}</p>
            <p>
              <strong>Price:</strong> ₹{astrologer.profile?.priceCharge}/min
            </p>
            <p>
              <strong>Experience:</strong> {astrologer.profile?.experience} years
            </p>
            <p>
              <strong>Languages:</strong>{' '}
              {astrologer.profile?.languages?.join(', ')}
            </p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '2rem' }}>
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={!pagination.hasPrevPage}
          >
            Previous
          </button>
          <span>
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={!pagination.hasNextPage}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CallAstrologersList;
```

### 4. Alternative: Using Context API (For Global State Management)

Create `src/context/CallAstrologersContext.js`:

```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCallAstrologersSocket } from '../hooks/useCallAstrologersSocket';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const CallAstrologersContext = createContext();

export const useCallAstrologers = () => {
  const context = useContext(CallAstrologersContext);
  if (!context) {
    throw new Error('useCallAstrologers must be used within CallAstrologersProvider');
  }
  return context;
};

export const CallAstrologersProvider = ({ children }) => {
  const [astrologers, setAstrologers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
  });

  // Fetch call astrologers
  const fetchCallAstrologers = useCallback(async (page = 1, limit = 10, filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${API_URL}/api/call/public/get-all-call-astrologers`,
        {
          params: {
            page,
            limit,
            ...filters,
          },
        }
      );

      if (response.data.success) {
        setAstrologers(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching call astrologers:', err);
      setError(err.response?.data?.message || 'Failed to fetch call astrologers');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle WebSocket update
  const handleUpdate = useCallback(
    (updateData) => {
      console.log('🔄 WebSocket update received:', updateData);
      
      // Re-fetch to get the latest data
      fetchCallAstrologers(pagination.currentPage, pagination.limit);
    },
    [fetchCallAstrologers, pagination]
  );

  // Initialize WebSocket
  const socketStatus = useCallAstrologersSocket(handleUpdate);

  // Initial fetch
  useEffect(() => {
    fetchCallAstrologers(1, 10);
  }, [fetchCallAstrologers]);

  const value = {
    astrologers,
    loading,
    error,
    pagination,
    fetchCallAstrologers,
    socketStatus,
  };

  return (
    <CallAstrologersContext.Provider value={value}>
      {children}
    </CallAstrologersContext.Provider>
  );
};
```

Usage in your App component:

```javascript
import React from 'react';
import { CallAstrologersProvider } from './context/CallAstrologersContext';
import CallAstrologersList from './components/CallAstrologersList';

function App() {
  return (
    <CallAstrologersProvider>
      <div className="App">
        <CallAstrologersList />
      </div>
    </CallAstrologersProvider>
  );
}

export default App;
```

### 5. Environment Variables

Create `.env` file in your React project root:

```env
REACT_APP_API_URL=http://localhost:3000
```

## Features

✅ **Automatic Reconnection**: Socket.IO automatically reconnects if connection is lost  
✅ **Real-time Updates**: Receives updates when `webhookCallHangup` is triggered  
✅ **Auto-refresh**: Automatically re-fetches the list when an update is received  
✅ **Connection Status**: Shows connection and subscription status  
✅ **Error Handling**: Handles connection errors gracefully  

## Testing

1. Start your backend server
2. Start your React app
3. Open the component that uses the hook
4. Check the browser console for connection logs
5. Trigger the webhook endpoint from Postman or another tool
6. Watch the astrologers list update automatically!

## Notes

- The WebSocket connection is established when the component mounts
- The connection automatically subscribes to updates
- When an update is received, the list is automatically re-fetched
- You can customize the update handler to update specific items instead of re-fetching (see commented code in the component)

