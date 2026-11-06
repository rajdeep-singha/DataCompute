import { Navigate, Route, Routes } from "react-router-dom"
import { AlertsViewer } from "./alerts/AlertsViewer"
import { ChecksViewer } from "./checks/ChecksViewer"
import { DiamondViewer } from "./diamond/DiamondViewer"
import { Docs } from "./Docs"
import { Intro } from "./Intro"
import { Landing } from "./Landing"
import { Layout } from "./Layout"
import { Marketplace } from "./marketplace/Marketplace"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Intro />} />
      <Route element={<Layout />}>
        <Route path="home" element={<Landing />} />
        <Route path="dashboard" element={<Navigate to="/home" replace />} />
        <Route path="alerts" element={<AlertsViewer />} />
        <Route path="diamond" element={<DiamondViewer />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="checks" element={<ChecksViewer />} />
        <Route path="docs" element={<Docs />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Route>
    </Routes>
  )
}
