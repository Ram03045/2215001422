
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 9876;


const WINDOW_SIZE = 10;
const TIMEOUT_MS = 2000;
const TEST_SERVER = 'http://20.244.56.144/evaluation-service';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQ0OTU3MjUxLCJpYXQiOjE3NDQ5NTY5NTEsImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6ImM2ZTYyM2M5LWFjN2MtNGM1MC05MWE4LTQ4MWU1ZTliNDdmZCIsInN1YiI6InJvaGl0Lmd1cHRhX2NzMjJAZ2xhLmFjLmluIn0sImVtYWlsIjoicm9oaXQuZ3VwdGFfY3MyMkBnbGEuYWMuaW4iLCJuYW1lIjoicm9oaXQgZ3VwdGEiLCJyb2xsTm8iOiIyMjE1MDAxNDg3IiwiYWNjZXNzQ29kZSI6IkNObmVHVCIsImNsaWVudElEIjoiYzZlNjIzYzktYWM3Yy00YzUwLTkxYTgtNDgxZTVlOWI0N2ZkIiwiY2xpZW50U2VjcmV0IjoicUpxTmJkR2tVcURUZ1dnSiJ9.x-gF2LtHCFuXM4R6rGBt8ZFf3MhuMb62XWjFs0yRC68';

const storage = {
  p: { numbers: [], windowPrevState: [], windowCurrState: [] },
  f: { numbers: [], windowPrevState: [], windowCurrState: [] },
  e: { numbers: [], windowPrevState: [], windowCurrState: [] },
  r: { numbers: [], windowPrevState: [], windowCurrState: [] }
};

async function fetchNumbers(type) {
  let endpoint;
  
  switch (type) {
    case 'p':
      endpoint = '/primes';
      break;
    case 'f':
      endpoint = '/fibo';
      break;
    case 'e':
      endpoint = '/even';
      break;
    case 'r':
      endpoint = '/rand';
      break;
    default:
      throw new Error('Invalid number type');
  }
  
  console.log(`Attempting to fetch ${type} numbers from ${TEST_SERVER}${endpoint}`);
  
  let timeoutId;
  
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      controller.abort();
      console.log(`Request for ${type} numbers timed out after ${TIMEOUT_MS}ms`);
    }, TIMEOUT_MS);
    
    console.log(`Headers being sent:`, {
      'Authorization': `Bearer ${AUTH_TOKEN.substring(0, 20)}...` // Only log part of the token for security
    });
    
    const response = await axios.get(`${TEST_SERVER}${endpoint}`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    clearTimeout(timeoutId);
    console.log(`Successfully fetched ${type} numbers:`, response.data.numbers);
    return response.data.numbers;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      console.error(`Request for ${type} numbers was aborted due to timeout`);
    } else if (error.response) {
     
      console.error(`Error fetching ${type} numbers: Status code ${error.response.status}`);
      console.error(`Error response data:`, error.response.data);
      console.error(`Error response headers:`, error.response.headers);
    } else if (error.request) {
     
      console.error(`Error fetching ${type} numbers: No response received`);
      console.error(`Request details:`, error.request._currentUrl);
    } else {
      
      console.error(`Error fetching ${type} numbers: ${error.message}`);
      console.error(`Error stack:`, error.stack);
    }
    
    return [];
  }
}


function storeNumbers(type, newNumbers) {
  console.log(`Processing ${newNumbers.length} new ${type} numbers`);
  
  const store = storage[type];
  

  store.windowPrevState = [...store.windowCurrState];
  console.log(`Previous window state:`, store.windowPrevState);
  

  let uniqueAdded = 0;
  for (const num of newNumbers) {
    if (!store.numbers.includes(num)) {
      store.numbers.push(num);
      uniqueAdded++;
    }
  }
  console.log(`Added ${uniqueAdded} unique numbers to storage`);
 
  if (store.numbers.length > WINDOW_SIZE) {
    const removed = store.numbers.length - WINDOW_SIZE;
    store.numbers = store.numbers.slice(-WINDOW_SIZE);
    console.log(`Removed ${removed} oldest numbers to maintain window size of ${WINDOW_SIZE}`);
  }
  
  
  store.windowCurrState = [...store.numbers];
  console.log(`Current window state:`, store.windowCurrState);
  

  const avg = store.numbers.length > 0 
    ? (store.numbers.reduce((sum, num) => sum + num, 0) / store.numbers.length).toFixed(2)
    : 0;
  console.log(`Calculated average: ${avg} for ${store.numbers.length} numbers`);
    
  return {
    windowPrevState: store.windowPrevState,
    windowCurrState: store.windowCurrState,
    numbers: store.numbers,
    avg: parseFloat(avg)
  };
}


app.get('/numbers/:numberid', async (req, res) => {
  const type = req.params.numberid;
  console.log(`\n--- Received request for ${type} numbers ---`);

  if (!['p', 'f', 'e', 'r'].includes(type)) {
    console.log(`Invalid number type requested: ${type}`);
    return res.status(400).json({ error: 'Invalid number type. Use p, f, e, or r.' });
  }
  
  try {
    console.log(`Fetching ${type} numbers from test server...`);
    const newNumbers = await fetchNumbers(type);
    
    if (newNumbers.length === 0) {
      console.log(`Warning: No ${type} numbers returned from API`);
    }
    
    console.log(`Processing and storing ${type} numbers...`);
    const result = storeNumbers(type, newNumbers);
    
    console.log(`Sending response for ${type} numbers request`);
    res.json({
      windowPrevState: result.windowPrevState,
      windowCurrState: result.windowCurrState,
      numbers: result.numbers,
      avg: result.avg
    });
    console.log(`--- Completed request for ${type} numbers ---\n`);
  } catch (error) {
    console.error(`!!! Error processing ${type} numbers request:`, error.message);
    console.error(error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/', (req, res) => {
  console.log('Health check request received');
  res.json({ 
    status: 'Average Calculator Microservice is running',
    storage: {
      p: { count: storage.p.numbers.length },
      f: { count: storage.f.numbers.length },
      e: { count: storage.e.numbers.length },
      r: { count: storage.r.numbers.length }
    }
  });
});


app.listen(PORT, () => {
  console.log(`Average Calculator Microservice running on port ${PORT}`);
  console.log(`Configuration: Window Size: ${WINDOW_SIZE}, Timeout: ${TIMEOUT_MS}ms`);
  console.log(`Health check available at: http://localhost:${PORT}/`);
  console.log(`API endpoints: /numbers/p, /numbers/f, /numbers/e, /numbers/r`);
});