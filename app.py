from flask import Flask, render_template, request, jsonify
from influxdb_client import InfluxDBClient
from config import INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, INFLUX_BUCKET

app = Flask(__name__)
client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
query_api = client.query_api()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/fetch_lrv_options', methods=['POST'])
def fetch_lrv_options():
    date = request.form['date']
    # Translate PHP SQL into Flux to get unique leadLRV & runsheetId
    flux = f'''from(bucket:"{INFLUX_BUCKET}")
      |> range(start: {date}T00:00:00Z, stop: {date}T23:59:59Z)
      |> filter(fn: (r) => r._measurement == "record")
      |> keep(columns:["runsheetId","eastFacingLrv"])
      |> group(columns:["runsheetId","eastFacingLrv"])
      |> distinct()'''
    tables = query_api.query(flux)
    lrvs = [ { 'leadLRV':t.records[0].values.get('eastFacingLrv'), 'runsheetId':t.records[0].values.get('runsheetId') }
             for t in tables ]
    return jsonify(success=True, lrvs=lrvs)

@app.route('/api/fetch_time_options', methods=['POST'])
def fetch_time_options():
    runsheet = request.form['runsheetId']
    date = request.form['date']
    lrv = request.form['leadLRV']
    flux = f'''from(bucket:"{INFLUX_BUCKET}")
      |> range(start: {date}T00:00:00Z, stop: {date}T23:59:59Z)
      |> filter(fn: (r) => r._measurement == "record" and r.runsheetId == "{runsheet}" and r.eastFacingLrv == "{lrv}")
      |> keep(columns:["_time"])
      |> sort(columns:["_time"])
      |> group()
      |> reduce(fn:(r, accumulator) => ({{ first: if accumulator.firstTime == "" then r._time else accumulator.first, last: r._time }}), identity:{{ firstTime: "", lastTime: "" }})'''
    tables = query_api.query(flux)
    if tables:
        rec = tables[0].records[0].values
        return jsonify(success=True, times=[{'firstTime':rec['firstTime'], 'lastTime':rec['lastTime']}])
    return jsonify(success=False, message="No times found")

@app.route('/api/fetch_chart_data_10min', methods=['POST'])
def fetch_chart_data_10min():
    runsheet = request.form['runsheetId']
    time = request.form.get('time')
    lrv = request.form.get('leadLRV')
    # Build flux to match PHP logic for rawData and RMS
    # (Use movingWindow or aggregateWindow for RMS calculation)
    # ... similar to PHP
    return jsonify(success=True, data=raw_data, rms_data=rms_data, row_count=len(raw_data))

@app.route('/api/fetch_chart_data_url', methods=['POST'])
def fetch_chart_data_url():
    # identical to above but using date+time from URL
    return fetch_chart_data_10min()

if __name__ == '__main__':
    app.run(debug=True)