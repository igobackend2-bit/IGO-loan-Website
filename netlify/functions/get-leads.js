exports.handler = async (event, context) => {
  const token = process.env.NETLIFY_TOKEN;
  const siteId = process.env.SITE_ID || "d049f742-b932-4bbd-ae47-15deb9a97924";

  if (!token || token.trim() === "") {
    return {
      statusCode: 200, // Return 200 so the frontend can read the body easily
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "NETLIFY_TOKEN not found",
        setup_needed: true 
      })
    };
  }

  try {
    // Use the built-in fetch in Node 18+
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/submissions`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const errData = await response.json();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: errData.message || "Netlify API error" })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
