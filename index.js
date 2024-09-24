/*
ORNELLAS            21/05/2024 15:52              Retorna horários e coordenadas GPS em que um veículo chegou em determinadas localidades ( pontos de interesse )...
*/
const { BigQuery } = require('@google-cloud/bigquery');

const cors = require('cors')({ origin: true });

const unirest = require('unirest'); // creates express http server


// Create a BigQuery client
const bigQueryClient = new BigQuery();

/**
 * A Cloud Function that processes vehicle data based on request JSON.
 *
 * @param {Object} req The HTTP request object.
 * @param {Object} res The HTTP response object.
 */
exports.processVehicleData = async (req, res) => {

 // Use the cors middleware to handle CORS headers
  cors(req, res, async () => {

   // Get the Authorization header from the request
  const authorizationHeader = req.headers['authorization'];

  // Check if the Authorization header is present
  if (!authorizationHeader) {
    return res.status(401).send('Unauthorized: No Authorization header');
  }

  // Assuming the Authorization header follows the format "Bearer <token>"
  const [bearer, token] = authorizationHeader.split(' ');

  // Check if the Authorization header starts with "Bearer"
  if (bearer !== 'Bearer' || !token) {
    return res.status(401).send('Unauthorized: Invalid Authorization header format');
  }

  // Now, 'token' contains the actual token that you can use in your function
  //console.log('Token:', token);
  

  //Verifica sessão ao invés de token fixo...
  const infoLogin = await unirest.post('https://www.aerosoftcargas.com.br/aeroctrl/gerais/infogeral.aspx')
    .headers({'Accept': 'text/plain', 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'})
    .send({ 'id': '3', 'session': token});
      
  //console.log(response.body);
  const info = infoLogin.body.split('|');

  if(!info[0] || info[0]!=='OK'){
    
     return res.status(401).send('Unauthorized: Invalid Authorization token');
   
   }
  


  try {
   
   
    const data = req.body; // Access the entire JSON object

  const placa = data.placa;
  const startDate = data.startDate;
  const endDate = data.endDate;
  const radius = data.radius;
  const pontosInteresse = data.pontos_interesse; // Array of objects

  //console.log(placa);
  //console.log(pontosInteresse);

  const eventos = [];

  for (pontoInteresse of pontosInteresse) {
    //console.log(pontoInteresse);

    const aquery = `call aeromobilejs.rastreamento_veiculos_ds.getChegada(
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
 



    
    // Set the Content-Type header to indicate JSON response
    res.set('Content-Type', 'application/json');
    
     // Set CORS headers in the response
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
   
  res.json(eventos);
  
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing vehicle data");
  }

  });
};
