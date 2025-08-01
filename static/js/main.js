document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const runsheetId = urlParams.get("runsheetId");
  const leadLRV = urlParams.get("leadLRV");
  const date = urlParams.get("date");
  const time = urlParams.get("time");

  let map = null;
  let stations = [];
  let stationMarkers = []; // Store station markers to prevent re-adding them
  let lrvMarker = null; // Store LRV marker to update it dynamically
  let charts = {}; // Object to keep track of chart instances

  const osciDate = document.getElementById("osciDate");

  // Parse date in format '22 Jul 24' to '2024-07-22'
  function parseDate(dateStr) {
    const months = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };
    const parts = dateStr.split(" ");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0"); // Ensure day is 2 digits
      const month = months[parts[1]];
      const year = "20" + parts[2]; // Assuming all dates are in 2000s
      return `${year}-${month}-${day}`;
    }
    return dateStr; // Return as-is if format is unexpected
  }

  // Check if runsheetId, leadLRV, date, and time are provided in the URL
  if (runsheetId && leadLRV && date && time) {
    const formattedDate = parseDate(date);
    fetchChartDataURL(runsheetId, leadLRV, formattedDate, time);
  }

  // When user selects a new date: clear existing charts & map, fetch LRV buttons, clear time buttons
  osciDate.addEventListener("change", function () {
    const selectedDate = osciDate.value;
    if (selectedDate) {
      clearChartsAndMap();
      fetchLrvOptions(selectedDate);

      // Clear any existing time buttons
      const timeContainer = document.getElementById("timeButtonsContainer");
      if (timeContainer) timeContainer.innerHTML = "";
    }
  });

  function clearChartsAndMap() {
    ["chart1", "chart2", "chart3", "chart4"].forEach((chartId) => {
      const chartContainer = document.getElementById(chartId);
      if (charts[chartId]) {
        charts[chartId].dispose();
        delete charts[chartId];
      }
      if (chartContainer) {
        chartContainer.innerHTML = "";
        chartContainer.classList.remove("chartBorder");
        chartContainer.style.display = "none";
      }
    });

    const mapDiv = document.getElementById("map");
    if (mapDiv) {
      mapDiv.style.display = "none";
      if (map !== null) {
        map.remove();
        map = null;
      }
    }

    const rowCountDiv = document.getElementById("row_count");
    if (rowCountDiv) {
      rowCountDiv.innerHTML = "";
    }
  }

  function clearChartsAndMapOnNoData() {
    ["chart1", "chart2", "chart3", "chart4"].forEach((chartId) => {
      const chartContainer = document.getElementById(chartId);
      if (charts[chartId]) {
        charts[chartId].dispose();
        delete charts[chartId];
      }
      if (chartContainer) {
        chartContainer.innerHTML = "";
        chartContainer.classList.remove("chartBorder");
        chartContainer.style.display = "none";
      }
    });

    const mapDiv = document.getElementById("map");
    if (mapDiv) {
      mapDiv.style.display = "none";
      if (map !== null) {
        map.remove();
        map = null;
      }
    }
  }

  // === Fetch and Render LRV Buttons for a Given Date ===
  function fetchLrvOptions(date) {
    const formData = new FormData();
    formData.append("date", date);

    const LRVspinner = document.getElementById("lrvLoadingSpinner");
    const container = document.getElementById("lrvButtonsContainer");

    LRVspinner.style.display = "block";
    if (container) container.style.display = "none";

    fetch("/api/fetch_lrv_options.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (!container) return;

        container.innerHTML = "";

        if (data.success) {
          if (data.lrvs.length > 0) {
            data.lrvs.forEach((lrv) => {
              const leadLRV = lrv.leadLRV ? `${lrv.leadLRV}` : "N/A";
              const runsheetIdVal = lrv.runsheetId ? `${lrv.runsheetId}` : "N/A";
              const buttonLabel = `${leadLRV} [${runsheetIdVal}]`;

              const button = document.createElement("button");
              button.className = "btn btn-success m-2 w-auto";
              button.textContent = buttonLabel;
              button.type = "button";

              // When an LRV button is clicked → fetch available times for that runsheetId + date
              button.onclick = (event) => {
                event.preventDefault();

                // Clear existing charts and map
                clearChartsAndMap();

                // Clear previous time buttons
                const timeContainer = document.getElementById(
                  "timeButtonsContainer"
                );
                if (timeContainer) timeContainer.innerHTML = "";

                // Pass leadLRV, runsheetIdVal, and date to fetchTimeOptions
                fetchTimeOptions(runsheetIdVal, date, leadLRV);
              };

              // Fetch new time buttons for this runsheetId
              container.appendChild(button);
            });
          } else if (data.message) {
            const message = document.createElement("p");
            message.className = "text-warning";
            message.textContent = data.message;
            container.appendChild(message);
          }
        } else {
          console.error(
            "Error: " + (data.error || "No LRVs found for the selected date.")
          );
        }
      })
      .catch((error) => console.error("Error fetching LRV options:", error))
      .finally(() => {
        LRVspinner.style.display = "none";
        if (container) container.style.display = "block";
      });
  }

  // === Fetch and Render Time Buttons for a Given runsheetId and date and leadLRV===
  function fetchTimeOptions(runsheetIdVal, date, leadLRV) {
    const formData = new FormData();
    formData.append("runsheetId", runsheetIdVal);
    formData.append("date", date);
    formData.append("leadLRV", leadLRV);

    const spinner = document.getElementById("timeLoadingSpinner");
    const container = document.getElementById("timeButtonsContainer");

    spinner.style.display = "block";
    if (container) container.style.display = "none";

    fetch("/api/fetch_time_options.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        //console.log("fetch_time_options response:", data);
        if (!container) return;

        // Clear any old buttons/messages
        container.innerHTML = "";

        if (
          data.success &&
          Array.isArray(data.times) &&
          data.times.length > 0
        ) {
          // We expect data.times[0] = { firstTime: "YYYY-MM-DD HH:mm:ss", lastTime: "YYYY-MM-DD HH:mm:ss" }
          const { firstTime, lastTime } = data.times[0];

          // Utility: convert "YYYY-MM-DD HH:mm:ss" → JavaScript Date (local)
          function parseMySQLDateTime(dtString) {
            // Replace the space with "T" so that Date() treats it as local
            // e.g. "2025-01-16 09:11:21" → "2025-01-16T09:11:21"
            return new Date(dtString.replace(" ", "T"));
          }

          // Utility: format a Date object back to "YYYY-MM-DD HH:mm:ss"
          function formatDateTimeForButton(dateObj) {
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
            const dd = String(dateObj.getDate()).padStart(2, "0");
            const HH = String(dateObj.getHours()).padStart(2, "0");
            const MM = String(dateObj.getMinutes()).padStart(2, "0");
            const SS = String(dateObj.getSeconds()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
          }

          const startDate = parseMySQLDateTime(firstTime);
          const endDate = parseMySQLDateTime(lastTime);

          // Step through every full hour from startDate up to (but not past) endDate
          let current = new Date(startDate);

          // Create one button per hourly step
          while (current < endDate) {
            const label = formatDateTimeForButton(current);
            const btn = document.createElement("button");
            btn.className = "btn btn-success m-2 w-auto";
            btn.textContent = label;
            btn.type = "button";

            // onclick grabs the exact `label` string and passes it to `fetchChartData(...)`
            btn.onclick = (e) => {
              e.preventDefault();
              const selectedTime = label;
              fetchChartData(runsheetIdVal, selectedTime, leadLRV);
            };

            container.appendChild(btn);

            // Advance by 30 minutes
            current.setMinutes(current.getMinutes() + 30);
            // // Advance by exactly 1 hour
            // current.setHours(current.getHours() + 1);
          }
        } else {
          const message = document.createElement("p");
          message.className = "text-warning";
          message.textContent =
            data.message || "No time data found for this LRV.";
          container.appendChild(message);
        }
      })
      .catch((error) => console.error("Error fetching time options:", error))
      .finally(() => {
        spinner.style.display = "none";
        if (container) container.style.display = "block";
      });
  }

  // === fetchChartData gets runsheetId, Time and leadLRV values===
  function fetchChartData(runsheetIdVal, time = null, leadLRV = null) {
    const formData = new FormData();
    formData.append("leadLRV", leadLRV);
    formData.append("runsheetId", runsheetIdVal);
    if (time !== null) {
      formData.append("time", time);
    }

    const spinner = document.getElementById("loadingSpinner");
    const rowCountDiv = document.getElementById("row_count");
    const mapDiv = document.getElementById("map");

    spinner.style.display = "block";
    rowCountDiv.style.display = "none";
    if (mapDiv) {
      mapDiv.style.display = "none";
      if (map !== null) {
        map.remove();
        map = null;
      }
    }

    ["chart1", "chart2", "chart3", "chart4"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    fetch("/api/fetch_chart_data.php", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const msg = payload?.error || `Server error: ${response.status}`;
          throw new Error(msg);
        }
        return payload;
      })
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const rawData = data.data; // 100 Hz samples
          const rmsData = data.rms_data || []; // 5 s-window RMS

          displayChart(rawData, rmsData);

          if (data.row_count !== undefined) {
            rowCountDiv.innerHTML =
              `<h3 class="text-success">Runsheet ID: ${runsheetIdVal} LRV: ${leadLRV}</h3>` +
              `<h3 class="text-success">Number of Rows: ${data.row_count}</h3>`;
          }
        } else {
          clearChartsAndMapOnNoData();
          rowCountDiv.innerHTML = `<div class="alert alert-warning">No data available for runsheet id: ${runsheetIdVal} LRV: ${leadLRV}</div>`;
        }
      })
      .catch((err) => {
        console.error("Chart-data error:", err.message);
        document.getElementById(
          "row_count"
        ).innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
      })
      // .catch((error) => {
      //   clearChartsAndMapOnNoData();
      //   console.error("Error fetching chart data:", error);
      //   rowCountDiv.innerHTML = `<div class="alert alert-warning">No data available for runsheet id: ${runsheetIdVal}</div>`;
      // })
      .finally(() => {
        spinner.style.display = "none";
        rowCountDiv.style.display = "block";
        ["chart1", "chart2", "chart3", "chart4"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.style.display = "block";
        });
      });
  }

  // === fetchChartDataURL for URL‐driven loads ===
  function fetchChartDataURL(runsheetIdVal, leadLRV, date, time) {
    const formData = new FormData();
    formData.append("runsheetId", runsheetIdVal);
    formData.append("leadLRV", leadLRV);
    formData.append("date", date);
    formData.append("time", time);

    const spinner = document.getElementById("loadingSpinner");
    const rowCountDiv = document.getElementById("row_count");
    const mapDiv = document.getElementById("map");

    spinner.style.display = "block";
    rowCountDiv.style.display = "none";
    if (mapDiv) {
      mapDiv.style.display = "none";
      if (map !== null) {
        map.remove();
        map = null;
      }
    }

    ["chart1", "chart2", "chart3", "chart4"].forEach((chartId) => {
      const chartContainer = document.getElementById(chartId);
      if (chartContainer) {
        chartContainer.style.display = "none";
      }
    });

    fetch("/api/fetch_chart_data_URL.php", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const rawData = data.data; // 100 Hz samples
          const rmsData = data.rms_data || []; // 5 s-window RMS

          displayChart(rawData, rmsData);

          if (data.row_count !== undefined) {
            rowCountDiv.innerHTML =
              `<h3 class="text-success">Runsheet ID: ${runsheetIdVal} LRV: ${leadLRV}</h3>` +
              `<h3 class="text-success">Number of Rows: ${data.row_count}</h3>`;
          }
        } else {
          clearChartsAndMapOnNoData();
          rowCountDiv.innerHTML = `<div class="alert alert-warning">No data available for runsheet id: ${runsheetIdVal} LRV: ${leadLRV}</div>`;
        }
      })
      .catch((error) => {
        clearChartsAndMapOnNoData();
        console.error("Error fetching chart data:", error);
        rowCountDiv.innerHTML = `<div class="alert alert-warning">No data available for runsheet id: ${runsheetIdVal} LRV: ${leadLRV}</div>`;
      })
      .finally(() => {
        spinner.style.display = "none";
        rowCountDiv.style.display = "block";
        ["chart1", "chart2", "chart3", "chart4"].forEach((chartId) => {
          const chartContainer = document.getElementById(chartId);
          if (chartContainer) {
            chartContainer.style.display = "block";
          }
        });
      });
  }

  // === Map and Chart Utility Functions ===
  function fetchStations() {
    fetch("/fetch_stations.php")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && Array.isArray(data.stations)) {
          stations = data.stations;
          stations.forEach((station) => {
            addStationToMap(station.lat, station.lng, station.name);
          });
        }
      })
      .catch((error) => console.error("Error fetching stations:", error));
  }

  function addStationToMap(lat, lng, name) {
    const stationIcon = L.divIcon({
      html: '<i class="fa fa-subway" style="font-size: 20px;"></i>',
      iconSize: [20, 20],
      className: "",
    });
    if (map) {
      const marker = L.marker([lat, lng], { icon: stationIcon })
        .addTo(map)
        .bindPopup(`Station: ${name}`)
        .openPopup();
      stationMarkers.push(marker);
    }
  }

  function findClosestStation(lat, lng) {
    let closestStation = null;
    let minDistance = Infinity;
    stations.forEach((station) => {
      const distance = getDistance(lat, lng, station.lat, station.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestStation = station;
      }
    });
    return closestStation;
  }

  function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  function showMap(lat, lng) {
    // sanity check: bail if either is null/undefined or not a number
    if (typeof lat !== "number" || typeof lng !== "number") {
      console.warn("showMap called with invalid coords");
      return;
    }
    const mapDiv = document.getElementById("map");
    if (mapDiv) {
      mapDiv.style.display = "block";
      if (map === null) {
        map = L.map("map").setView([lat, lng], 13);
        fetchStations();
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
      } else {
        map.setView([lat, lng], 13);
      }

      if (lrvMarker) {
        map.removeLayer(lrvMarker);
      }

      const redIcon = L.divIcon({
        html: '<i class="fa fa-map-marker" style="font-size: 48px; color: red"></i>',
        iconSize: [48, 48],
        className: "",
      });

      lrvMarker = L.marker([lat, lng], { icon: redIcon })
        .addTo(map)
        .bindPopup(`LRV is at Lat: ${lat}, Lng: ${lng}`)
        .openPopup();

      const closestStation = findClosestStation(lat, lng);
      if (closestStation) {
        lrvMarker
          .bindPopup(
            `LRV is at Lat: ${lat}, Lng: ${lng}. Closest station: ${closestStation.name} (Lat: ${closestStation.lat}, Lng: ${closestStation.lng})`
          )
          .openPopup();
      }
    }
  }

  function displayChart(rawData, rmsData) {
    $(window).ready(() => {
      if (!Array.isArray(rawData) || rawData.length === 0) {
        console.error("No raw data available or invalid format.");
        return;
      }
      rawData.forEach((point, i) => {
        if (
          point.time === undefined ||
          point.x === undefined ||
          point.y === undefined ||
          point.z === undefined
        ) {
          console.warn(`Missing rawData at index ${i}`, point);
        }
      });

      createChart(
        "chart1",
        "Lateral Acceleration (X)",
        "Lateral Acceleration",
        rawData.map((p) => p.x_filtered || 0),
        "#26a0fc",
        rawData,
        "chart1"
      );
      createChart(
        "chart2",
        "Longitudinal Acceleration (Y)",
        "Longitudinal Acceleration",
        rawData.map((p) => p.y_filtered || 0),
        "#26e7a6",
        rawData,
        "chart2"
      );
      createChart(
        "chart3",
        "Vertical Acceleration (Z)",
        "Vertical Acceleration",
        rawData.map((p) => p.z_filtered || 0),
        "#febc3b",
        rawData,
        "chart3"
      );

      if (!Array.isArray(rmsData) || rmsData.length === 0) {
        console.warn("No RMS data available or invalid format.");
        return;
      }
      rmsData.forEach((point, i) => {
        if (point.time === undefined || point.rms_x === undefined) {
          console.warn(`Missing rmsData at index ${i}`, point);
        }
      });
      createChart(
        "chart4",
        "Lateral RMS (5s Window)",
        "Lateral RMS",
        rmsData.map((p) => p.rms_x || 0),
        "#8b75d7",
        rmsData,
        "chart4"
      );
    });
  }

  function createChart(
    elementId,
    title,
    seriesName,
    data,
    color,
    chartData,
    chartId
  ) {
    const chartContainer = document.querySelector(`#${elementId}`);
    if (!chartContainer) {
      console.error(`Chart container with ID "${elementId}" not found.`);
      return;
    }
    chartContainer.style.height = "350px";

    if (charts[chartId]) {
      charts[chartId].dispose();
    }

    if (!Array.isArray(chartData) || chartData.length === 0) {
      console.error(`No valid data available for chart: ${chartId}`);
      return;
    }

    try {
      const xAxisData = chartData.map((point) =>
        point.time ? new Date(point.time).getTime() : null
      );
      const yAxisData = data.map((val) =>
        val !== null && val !== undefined ? val : 0
      );

      if (
        xAxisData.some((val) => val === null) ||
        yAxisData.some((val) => isNaN(val))
      ) {
        console.error(`Invalid data detected for chart: ${chartId}`);
        return;
      }

      let seriesObj = {
        name: seriesName,
        type: "line",
        areaStyle: { color: color, opacity: 0.5 },
        smooth: true,
        data: chartData.map((point, index) => [
          xAxisData[index],
          yAxisData[index],
        ]),
        lineStyle: { color: color },
        showSymbol: false,
        itemStyle: { color: color },
      };

      if (chartId === "chart1") {
        seriesObj.markLine = {
          silent: true,
          symbol: "none",
          label: {
            formatter: "Transient RQ Limit 0.875m/s2 (0.7m/s2 at seat)",
            position: "end",
            color: "green",
            fontWeight: "bold",
          },
          lineStyle: { color: "green", type: "dashed" },
          data: [
            { yAxis: 0.875 },
            { yAxis: -0.875 },
            {
              yAxis: 3,
              label: {
                formatter: "Transient Limit 3m/s2",
                position: "end",
                color: "red",
                fontWeight: "bold",
              },
              lineStyle: { color: "red", type: "dashed" },
            },
            {
              yAxis: -3,
              label: {
                formatter: "Transient Limit 3m/s2",
                position: "end",
                color: "red",
                fontWeight: "bold",
              },
              lineStyle: { color: "red", type: "dashed" },
            },
            {
              yAxis: 2.25,
              label: {
                formatter: "intermediate Limit 2.25m/s2",
                position: "end",
                color: "orange",
                fontWeight: "bold",
              },
              lineStyle: { color: "orange", type: "dashed" },
            },
            {
              yAxis: -2.25,
              label: {
                formatter: "intermediate Limit 2.25m/s2",
                position: "end",
                color: "orange",
                fontWeight: "bold",
              },
              lineStyle: { color: "orange", type: "dashed" },
            },
          ],
        };
      } else if (chartId === "chart4") {
        seriesObj.markLine = {
          silent: true,
          symbol: "none",
          label: {
            formatter: "Sustained RQ Limit 0.625m/s2 (0.5m/s2 at seat)",
            position: "end",
            color: "green",
            fontWeight: "bold",
          },
          lineStyle: { color: "green", type: "dashed" },
          data: [
            { yAxis: 0.625 },
            {
              yAxis: 1.6,
              label: {
                formatter: "intermediate Limit 1.6m/s2",
                position: "end",
                color: "orange",
                fontWeight: "bold",
              },
              lineStyle: { color: "orange", type: "dashed" },
            },
            {
              yAxis: 2.15,
              label: {
                formatter: "Sustained Limit 2.15m/s2",
                position: "end",
                color: "red",
                fontWeight: "bold",
              },
              lineStyle: { color: "red", type: "dashed" },
            },
          ],
        };
      }

      let yAxisConfig;
      switch (chartId) {
        case "chart1":
          yAxisConfig = {
            type: "value",
            name: "Acceleration (m/s²)",
            nameLocation: "middle",
            nameRotate: 90,
            nameTextStyle: { fontWeight: "bold", padding: [0, 0, 15, 0] },
            min: -4,
            max: 4,
          };
          break;
        case "chart2":
          yAxisConfig = {
            type: "value",
            name: "Acceleration (m/s²)",
            nameLocation: "middle",
            nameRotate: 90,
            nameTextStyle: { fontWeight: "bold", padding: [0, 0, 15, 0] },
            min: -3,
            max: 3,
          };
          break;
        case "chart3":
          yAxisConfig = {
            type: "value",
            name: "Acceleration (m/s²)",
            nameLocation: "middle",
            nameRotate: 90,
            nameTextStyle: { fontWeight: "bold", padding: [0, 0, 15, 0] },
            min: -2,
            max: 2,
          };
          break;
        case "chart4":
          yAxisConfig = {
            type: "value",
            name: "Acceleration (m/s²)",
            nameLocation: "middle",
            nameRotate: 90,
            nameTextStyle: { fontWeight: "bold", padding: [0, 0, 15, 0] },
            min: 0,
            max: 2.5,
          };
          break;
        default:
          yAxisConfig = {
            type: "value",
            name: "Acceleration (m/s²)",
            nameLocation: "middle",
            nameRotate: 90,
            nameTextStyle: { fontWeight: "bold", padding: [0, 0, 15, 0] },
            min: -2,
            max: 2,
          };
      }

      const options = {
        title: { text: title, left: "center" },
        tooltip: {
          trigger: "axis",
          formatter: function (params) {
            const point = params[0];
            const date = new Date(point.value[0]); // assumes UTC ms
            const h = date.getHours().toString().padStart(2, "0");
            const m = date.getMinutes().toString().padStart(2, "0");
            const s = date.getSeconds().toString().padStart(2, "0");
            const ms = date.getMilliseconds().toString().padStart(3, "0");
            return `
              ${point.seriesName}<br />
              Time: ${h}:${m}:${s}.${ms}<br />
              Value: ${point.value[1].toFixed(3)}
            `;
          },
        },
        xAxis: {
          type: "time",
          axisLabel: {
            formatter: function (value) {
              const date = new Date(value); // assumes UTC ms
              const h = date.getHours().toString().padStart(2, "0");
              const m = date.getMinutes().toString().padStart(2, "0");
              const s = date.getSeconds().toString().padStart(2, "0");
              const ms = date.getMilliseconds().toString().padStart(3, "0");
              return `${h}:${m}:${s}.${ms}`;
            },
          },
        },
        yAxis: yAxisConfig,
        series: [seriesObj],
        dataZoom: [
          { type: "slider", xAxisIndex: 0, start: 0, end: 100 },
          { type: "inside", xAxisIndex: 0 },
        ],
        toolbox: {
          feature: {
            saveAsImage: {},
            restore: {},
          },
          right: 20,
        },
      };

      charts[chartId] = echarts.init(chartContainer);
      charts[chartId].group = "Group";
      charts[chartId].setOption(options);
      chartContainer.classList.add("chartBorder");

      charts[chartId].on("click", function (event) {
        const idx = event.dataIndex;
        const pt = chartData[idx];
        // only proceed if pt exists and both coords are real numbers
        if (pt && typeof pt.lat === "number" && typeof pt.lng === "number") {
          showMap(pt.lat, pt.lng);
        } else {
          console.warn("Invalid/missing coordinates on clicked data point");
        }
      });

      charts[chartId].resize();
      window.addEventListener("resize", () => {
        charts[chartId].resize();
      });
    } catch (error) {
      console.error(`Error in chart creation for ${elementId}:`, error);
    }
  }

  // Enable zoom sync across all charts in group "Group"
  echarts.connect("Group");
});