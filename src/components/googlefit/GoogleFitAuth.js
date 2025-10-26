// GoogleFitAuth.jsx
import React, { useEffect, useState } from "react";

export default function GoogleFitAuth({ userId }) {
  const [authUrl, setAuthUrl] = useState("");

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/googlefit/auth/${userId}`)
      .then((res) => res.json())
      .then((data) => setAuthUrl(data.url))
      .catch(console.error);
  }, [userId]);

  if (!authUrl) return <span>Loading Google Fit Auth...</span>;

  return (
    <a href={authUrl} target="_blank" rel="noreferrer">
      <button className="btn btn-success ms-2">Connect Google Fit</button>
    </a>
  );
}
