import desktopSplashVideo from '../assets/desktop-splash.mp4'
import mobileSplashImage from '../assets/mobileSplash.gif'

export function SplashScreen({ isReady }: { isReady: boolean }) {
  return (
    <div id="splashScreen" className="splash-screen">
      <video className="splash-video desktop-video" autoPlay muted playsInline preload="auto">
        <source src={desktopSplashVideo} type="video/mp4" />
      </video>
      <img
        className="splash-image mobile-splash-image"
        src={mobileSplashImage}
        alt="UDOT Traffic Cameras Splash Screen"
      />
      {!isReady && <div className="app-splash-status">Loading camera views...</div>}
    </div>
  )
}