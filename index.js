/*
ORNELLAS          23/05/2024 07:41             Endpoint "Pontos de interesse" 
                                               ( Lista horários de chegada dos veículos nos endereços de coleta/entrega, etc...)
*/
const express = require("express");
const bodyParser = require("body-parser");
const { BigQuery } = require("@google-cloud/bigquery");

const app = express();
const port = 3000;

// Create a BigQuery client
const bigQueryClient = new BigQuery();

// Configure body-parser to handle JSON requests
app.use(bodyParser.json());

// Define a simple route to test the API
app.get("/", (req, res) => {
  res.send("Bem vindo à API de Pontos de Interesse!");
});

// Route to handle a POST request with data in the body
app.post("/api", async (req, res) => {
  //console.log('Received data:', req.body);

  const data = req.body; // Access the entire JSON object

  const placa = data.placa;
  const startDate = data.startDate;
  const endDate = data.endDate;
  const radius = data.radius;
  const pontosInteresse = data.pontos_interesse; // Array of objects

  //console.log(placa);
  //console.log(pontosInteresse);

  const eventos = [];
  
  const procName= process.env.PROC_NAME;

  for (pontoInteresse of pontosInteresse) {
    //console.log(pontoInteresse);

    const aquery = `call ${procName}(
        "${placa}",
        "${startDate}",
        "${endDate}",
        "${pontoInteresse.lat}",
        "${pontoInteresse.lon}"
      ) ;`;

    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    const options = {
      query: aquery,
      // Location must match that of the dataset(s) referenced in the query.
      location: "southamerica-east1",
    };

    // Run the query as a job
    const [job] = await bigQueryClient.createQueryJob(options);
    //console.log(`Job ${job.id} started.`);

    // Wait for the query to finish
    const [rows] = await job.getQueryResults();

    //console.log(rows);
    if (rows && rows.length > 0) {

      const evento = rows[0];

      if (evento && evento.distance_km) {

        if (parseFloat(evento.distance_km) <= parseFloat(radius)) {

          eventos.push({
            label: pontoInteresse.label,
            distance: evento.distance_km,
            lat: evento.lat,
            lon: evento.lon,
            dthr: evento.dthr,
            odom: evento.odom,
            end: evento.end,
            tipo: "Chegada"
          });

       }
      }
    }
  }
 

  res.json(eventos);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
