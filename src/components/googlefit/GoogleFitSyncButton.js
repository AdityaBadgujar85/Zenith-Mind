// GoogleFitSyncButton.jsx
import React, { useContext, useState } from "react";
import { GoogleFitContext } from "../../context/GoogleFitProvider";

export default function GoogleFitSyncButton({ userId }) {
  const { setSleepData } = useContext(GoogleFitContext);
  const [loading, setLoading] = useState(false);

  const syncData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/googlefit/sleep/${userId}`);
      const data = await res.json();
      setSleepData(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <button className="btn btn-primary ms-2" onClick={syncData} disabled={loading}>
      {loading ? "Syncing..." : "Sync Google Fit Sleep Data"}
    </button>
  );
}
