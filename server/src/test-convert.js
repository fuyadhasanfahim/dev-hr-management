import axios from "axios";

const QUOTATION_ID = "69ea34b31bb32f2f3074704b"; // Replace with a valid ID from your DB
const AUTH_TOKEN =
    "vqsNhnB6DAQfuvEV4jevOoUGr9WVpsRj.7IcLHq1uCrwzMXlWLjIwupKCK41q3wwFwJRu64x2%2Fds%3D"; // Use the better-auth.session_token value

async function testConvert() {
  try {
    const response = await axios.post(
      `http://localhost:5000/api/quotations/${QUOTATION_ID}/convert`,
      {},
      {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          // Cookie: `better-auth.session-token=${AUTH_TOKEN}` // Fallback/alternative
        },
      },
    );
    console.log("SUCCESS:", response.data);
  } catch (error) {
    if (error.response) {
      console.error("ERROR 500:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("ERROR:", error.message);
    }
  }
}

testConvert();
