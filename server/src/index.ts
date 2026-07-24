import "dotenv/config";
import { createApp } from "./app";
import { logger } from "./utils/logger";

const port = Number(process.env.PORT || 8787);
const app = createApp();

app.listen(port, () => {
  logger.info("Contact API server started", {
    port,
    url: `http://localhost:${port}`,
  });
});
