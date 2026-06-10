import { AuthPanel } from "@/components/auth-panel"
import { PatriotsMessenger } from "@/components/patriots-messenger"
import { StatusBarSetup } from "@/components/status-bar-setup"

export default function Home() {
  return (
    <>
      <StatusBarSetup />
      <header className="site-header">
        <div>
          <p className="eyebrow">Private by design</p>
          <h1 className="hidden">PatriotsMessenger<sup>TM</sup></h1>
          <p><a href="https://www.authflow.net">AuthFlow</a><sup>TM</sup> sign-in, browser-side encryption, socket-speed delivery.</p>
        </div>
        <AuthPanel />
      </header>
      <PatriotsMessenger standalone />
    </>
  )
}
