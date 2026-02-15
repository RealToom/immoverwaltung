import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";

const port = env.PORT;

app.listen(port, () => {
  console.log(`Server laeuft auf http://localhost:${port}`);
  console.log(`Umgebung: ${env.NODE_ENV}`);
});
