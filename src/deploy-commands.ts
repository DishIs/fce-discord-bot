import { REST, Routes } from "discord.js";
import * as login     from "./commands/login.js";
import * as logout    from "./commands/logout.js";
import * as status    from "./commands/status.js";
import * as usage     from "./commands/usage.js";
import * as inbox     from "./commands/inbox.js";
import * as messages  from "./commands/messages.js";
import * as read      from "./commands/read.js";
import * as otp       from "./commands/otp.js";
import * as domains   from "./commands/domains.js";
import * as watch     from "./commands/watch.js";
import * as plans     from "./commands/plans.js";
import * as quickstart from "./commands/quickstart.js";
import * as timeline  from "./commands/timeline.js";
import * as insights  from "./commands/insights.js";
import * as help      from "./commands/help.js";
import * as guide     from "./commands/guide.js";
import * as support   from "./commands/support.js";
import * as ping      from "./commands/ping.js";
import * as me        from "./commands/me.js";
import * as feedback  from "./commands/feedback.js";
import * as format    from "./commands/format.js";
import * as settings  from "./commands/settings.js";
import * as pin       from "./commands/pin.js";

const token     = process.env.DISCORD_TOKEN!;
const clientId  = process.env.DISCORD_CLIENT_ID!;

const commands = [
  login, logout, status, usage, inbox, messages, read, otp,
  domains, watch, plans, quickstart, timeline, insights,
  help, guide, support, ping, me, feedback, format,
  settings, pin,
].map((m) => m.data.toJSON());

const rest = new REST().setToken(token);

(async () => {
  console.log(`Deploying ${commands.length} slash commands…`);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("Done.");
})();
