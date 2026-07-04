import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { Toast } from "./components/Toast";
import { useShunt } from "./store";
import { Onboarding } from "./screens/Onboarding";
import { ConnectWallet } from "./screens/ConnectWallet";
import { Home } from "./screens/Home";
import { ConfigureShunt } from "./screens/ConfigureShunt";
import { AutoSplitConfirm } from "./screens/AutoSplitConfirm";
import { SavingsVault } from "./screens/SavingsVault";
import { SendPay } from "./screens/SendPay";
import { TopUp } from "./screens/TopUp";
import { Activity } from "./screens/Activity";
import { Settings } from "./screens/Settings";

export default function App() {
  const address = useShunt((s) => s.address);
  const { pathname } = useLocation();
  const fullScreen = ["/", "/connect", "/confirm"].includes(pathname);

  return (
    <div className="app-shell">
      <Toast />
      <Routes>
        <Route path="/" element={address ? <Navigate to="/home" replace /> : <Onboarding />} />
        <Route path="/connect" element={<ConnectWallet />} />
        <Route path="/home" element={address ? <Home /> : <Navigate to="/" replace />} />
        <Route path="/shunt" element={address ? <ConfigureShunt /> : <Navigate to="/" replace />} />
        <Route path="/confirm" element={<AutoSplitConfirm />} />
        <Route path="/savings" element={address ? <SavingsVault /> : <Navigate to="/" replace />} />
        <Route path="/send" element={address ? <SendPay /> : <Navigate to="/" replace />} />
        <Route path="/topup" element={address ? <TopUp /> : <Navigate to="/" replace />} />
        <Route path="/activity" element={address ? <Activity /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={address ? <Settings /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!fullScreen && address && <TabBar />}
    </div>
  );
}
