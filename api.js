const http = require("http");
var express = require("express");
var app = express();

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ limit: "150mb", extended: false }));
app.use(bodyParser.json({ limit: "150mb" }));

app.listen(3000, function() {
  console.log("server running at 3000 port");
});

const API_HOST = process.argv[2].split(":")[0];
const API_PORT = process.argv[2].split(":")[1];


const Pool = require('pg').Pool
const pool = new Pool({
  user: 'ahndgnxzdjgkbb',
  host: 'ec2-52-44-166-58.compute-1.amazonaws.com',
  database: 'd8176h8c22rghg',
  password: '2846a06090561d0f78541f1db70a070ba6e70a9b2979c32e695eb7e642fefa2b',
  port: 5432,
})


app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});


app.get("/locations", function(req, res) {
  var locations = [];

  pool.query("SELECT name FROM vehicles where state= 'register'", (error, results) => {
    if (error) {
      throw error
    }
    if(results.rows[0]){
       results.rows.forEach((v)=>{ 
        
	pool.query('SELECT lat,long,date,vehicle_name FROM locations where vehicle_name= $1 ORDER BY date DESC',[v.name], (error, result) => {
          if (error) {
            throw error
          }
          if(result.rows[0]){
            locations.push({"lat":result.rows[0].lat,"lng":result.rows[0].long, "name":result.rows[0].vehicle_name});		
    	  }
        })        
      });
    }
    setTimeout(() => {  res.status(200).json(locations);  }, 3000);
  })
});


app.post("/vehicles", function(req, res) {
  var name = req.body.id;
  pool.query('SELECT name FROM vehicles where name= $1',[name], (error, results) => {
    if (error) {
      throw error
    }
    if(results.rows[0]){
      updateVehicleState(name,'register');
    }
    else{
      createVehicleId(name); 
    }
  })
  res.status(204).json();
});

app.post("/vehicles/:id/locations", function(req, res) {
  var name = req.params.id;
  var lat = req.body.lat;
  var long = req.body.lng;
  var date = req.body.at;
  pool.query('SELECT state FROM vehicles where name= $1',[name], (error, results) => {
    if (error) {
      throw error
    }
    if(results.rows[0] && results.rows[0].state == 'register'){
      updateLocation(name,lat,long,date);
    }
    else{
      throw error 
    }
    
  })
  res.status(204).json();
});

app.delete("/vehicles/:id", function(req, res) {
  var name = req.params.id;
  pool.query('SELECT state FROM vehicles where name= $1',[name], (error, results) => {
    if (error) {
      throw error
    }
    if(results.rows[0] && results.rows[0].state == 'register'){
      updateVehicleState(name,'deregister');
    }
    else{
      throw error 
    }
  })
  res.status(204).json();
});

function updateLocation(name,lat,long,date){
  pool.query("INSERT INTO locations(vehicle_name,lat,long,date) VALUES ($1,$2,$3,$4)",[name, lat, long, date], (error, results) => {
    if (error) {
      throw error
    }
  })
}

function updateVehicleState(name, state){
  pool.query("UPDATE vehicles set state=$2 where name= $1",[name, state], (error, results) => {
    if (error) {
      throw error
    }
  })
  pool.query("INSERT INTO registrations(vehicle_name,state,date) VALUES ($1,$2,$3)",[name, state, new Date()], (error, results) => {
    if (error) {
      throw error
    }
  })
}

function createVehicleId(name){
  pool.query("INSERT INTO vehicles(name) VALUES ($1)",[name], (error, results) => {
    if (error) {
      throw error
    }
    updateVehicleState(name,'register');
  })
}



function updateVehicleLocation(vehicleId, lat, lng) {
  request(
    `/vehicles/${vehicleId}/locations`,
    "POST",
    { lat, lng, at: new Date().toISOString() },
    res => {
      console.log(
        `Vehicle ${vehicleId.split("-")[0]} moved to: ${lat}, ${lng}`
      );
    }
  );
}

function registerVehicle(vehicleId) {
  request(`/vehicles`, "POST", { id: vehicleId }, res => {
    console.log(`New vehicle registered: ${vehicleId}`);
  });
}

function deregisterVehicle(vehicleId) {
  request(`/vehicles/${vehicleId}`, "DELETE", null, res => {
    console.log(`Vehicle de-registered: ${vehicleId}`);
  });
}

function request(path, method, body, cb) {
  const data = JSON.stringify(body)

  const req = http.request(
    { hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    },
    cb
  );

  if (body) {
    req.write(data);
  }

  req.on("error", error => {
    if (error.code === "ECONNREFUSED") {
      console.log(
        `The simulator couldn't reach the API at ${API_HOST}:${API_PORT}`
      );
    } else {
      console.log(error);
    }
  });

  req.end();
}

module.exports = {
  updateVehicleLocation,
  registerVehicle,
  deregisterVehicle
};
