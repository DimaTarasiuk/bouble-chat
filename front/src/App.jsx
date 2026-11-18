import { useState } from "react";
import ChatPage from "./ChatPage";
import RandomPage from "./RandomPage";

const VIEW_KEY = "app_view";

function App() {
  const [view, setView] = useState(() => sessionStorage.getItem(VIEW_KEY) || "random");

  const go = (next) => {
    sessionStorage.setItem(VIEW_KEY, next);
    setView(next);
  };

  return view === "account"
    ? <ChatPage onOpenRandom={() => go("random")} />
    : <RandomPage onOpenAccount={() => go("account")} />;
}

export default App
