document.getElementById("loadBtn").addEventListener("click", () => {
  const field = document.getElementById("fieldSelect").value;
  fetch(`/api/data?measurement=record&field=${field}`)
    .then(res => res.json())
    .then(data => {
      const labels = data.map(pt => new Date(pt.time).toLocaleTimeString());
      const values = data.map(pt => pt.value);

      renderChart(labels, values, field);
    });
});

let chart = null;
function renderChart(labels, data, label) {
  const ctx = document.getElementById("chart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label, data, tension:0.3 }] },
    options: { scales: { x: { display: true }, y: { display: true } } }
  });
}
