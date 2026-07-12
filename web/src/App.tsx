import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TabBar } from "./components/TabBar";
import { Toast } from "./components/Toast";
import { PageTransition } from "./components/PageTransition";
import { useShunt } from "./store";
import { Onboarding } from "./screens/Onboarding";
import { ConnectWallet } from "./screens/ConnectWallet";
import { Home } from "./screens/Home";
import { ConfigureShunt } from "./screens/ConfigureShunt";
import { AutoSplitConfirm } from "./screens/AutoSplitConfirm";
import { SavingsVault } from "./screens/SavingsVault";
import { SendPay } from "./screens/SendPay";
import { TopUp } from "./screens/TopUp";
import { RequestPay } from "./screens/RequestPay";
import { PayRequest } from "./screens/PayRequest";
import { Activity } from "./screens/Activity";
import { Settings } from "./screens/Settings";

export default function App() {
  const address = useShunt((s) => s.address);
  const location = useLocation();
  const { pathname } = location;
  const fullScreen = ["/", "/connect", "/confirm", "/pay"].includes(pathname);
  const t = (el: React.ReactNode) => <PageTransition>{el}</PageTransition>;

  return (
    <div className={`app-shell ${!fullScreen && address ? "with-rail" : ""}`}>
      <Toast />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={pathname}>
          <Route path="/" element={address ? <Navigate to="/home" replace /> : t(<Onboarding />)} />
          <Route path="/connect" element={t(<ConnectWallet />)} />
          <Route path="/home" element={address ? t(<Home />) : <Navigate to="/" replace />} />
          <Route path="/shunt" element={address ? t(<ConfigureShunt />) : <Navigate to="/" replace />} />
          <Route path="/confirm" element={t(<AutoSplitConfirm />)} />
          <Route path="/savings" element={address ? t(<SavingsVault />) : <Navigate to="/" replace />} />
          <Route path="/send" element={address ? t(<SendPay />) : <Navigate to="/" replace />} />
          <Route path="/topup" element={address ? t(<TopUp />) : <Navigate to="/" replace />} />
          <Route path="/request" element={address ? t(<RequestPay />) : <Navigate to="/" replace />} />
          {/* Public payer landing — the payer has no wallet connected here */}
          <Route path="/pay" element={t(<PayRequest />)} />
          <Route path="/activity" element={address ? t(<Activity />) : <Navigate to="/" replace />} />
          <Route path="/settings" element={address ? t(<Settings />) : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      {!fullScreen && address && <TabBar />}
    </div>
  );
}
