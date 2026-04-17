const { getStore } = require("@netlify/blobs");

exports.handler = async function (event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };

  var jobId = event.queryStringParameters && event.queryStringParameters.jobId;
  if (!jobId) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "jobId required" }) };

  try {
    var store = getStore({ name: "jobs", consistency: "strong" });
    var job = await store.get(jobId, { type: "json" });
    if (!job) return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Job not found" }) };

    return {
      statusCode: 200,
      headers: Object.assign({}, headers, { "Content-Type": "application/json" }),
      body: JSON.stringify(job),
    };
  } catch(err) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: err.message }) };
  }
};
