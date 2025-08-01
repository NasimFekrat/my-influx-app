from flask import Flask, render_template, jsonify, request
from influxdb_client import InfluxDBClient
from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET

app = Flask(__name__)

# initialize InfluxDB client once
client = InfluxDBClient(
    url=INFLUX_URL,
    token=INFLUX_TOKEN,
    org=INFLUX_ORG
)
query_api = client.query_api()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/data")
def data():
    """
    Example: GET /api/data?measurement=record&field=x
    Returns last 100 points as JSON.
    """
    measurement = request.args.get("measurement", "record")
    field       = request.args.get("field", "x")

    flux = f'''
    from(bucket:"{INFLUX_BUCKET}")
      |> range(start: -1h)
      |> filter(fn: (r) => r._measurement == "{measurement}")
      |> filter(fn: (r) => r._field == "{field}")
      |> limit(n:100)
    '''

    tables = query_api.query(flux)
    points = []
    for table in tables:
        for record in table.records:
            points.append({
                "time": record.get_time().isoformat(),
                "value": record.get_value()
            })

    return jsonify(points)

if __name__ == "__main__":
    app.run(debug=True)