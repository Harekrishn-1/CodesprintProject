const axios = require('axios');

// Self-hosted Judge0 ka base URL (.env me JUDGE0_URL daalna)
const JUDGE0_URL = process.env.JUDGE0_URL || 'http://127.0.0.1:2358';

const getLanguageById = (lang) => {
  const language = {
    "c++": 54,
    "java": 62,
    "javascript": 63
  };

  return language[lang.toLowerCase()];
};

const submitBatch = async (submissions) => {
  const options = {
    method: 'POST',
    url: `${JUDGE0_URL}/submissions/batch`,
    params: {
      base64_encoded: 'false'
    },
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      submissions
    }
  };

  async function fetchData() {
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }

  return await fetchData();
};

// Proper delay — pehle wala setTimeout actually wait nahi karta tha
const waiting = (timer) => new Promise((resolve) => setTimeout(resolve, timer));

const submitToken = async (resultToken) => {
  const options = {
    method: 'GET',
    url: `${JUDGE0_URL}/submissions/batch`,
    params: {
      tokens: resultToken.join(","),
      base64_encoded: 'false',
      fields: '*'
    }
  };

  async function fetchData() {
    try {
      const response = await axios.request(options);
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }

  while (true) {
    const result = await fetchData();

    const IsResultObtained = result.submissions.every((r) => r.status_id > 2);

    if (IsResultObtained)
      return result.submissions;

    await waiting(1000);
  }
};

module.exports = { getLanguageById, submitBatch, submitToken };