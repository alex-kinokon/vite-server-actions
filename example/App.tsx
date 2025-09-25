import { useEffect, useState } from "react";

import { getData } from "./action";

function App() {
  const [data, setData] = useState<{ version: string; userAgent: string | null }>();

  useEffect(() => {
    getData()
      .then(setData)
      .catch(e => {
        console.error("Error", e);
      });
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1 style={{ color: "#333" }}>System Information</h1>
      <div style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}>
        {data ? (
          <div>
            <p>
              <strong>OS Version:</strong> {data.version}
            </p>
            <p>
              <strong>User Agent:</strong> {data.userAgent}
            </p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}

export default App;
