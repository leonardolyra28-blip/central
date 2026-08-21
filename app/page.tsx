import { requireChatGPTUser } from "./chatgpt-auth";
import CentralClient from "./central-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return (
    <CentralClient
      initialUser={user.displayName}
      initialEmail={user.email}
    />
  );
}
