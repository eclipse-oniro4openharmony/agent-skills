// Canonical visual and animation template for splash-launch-animation.
// Replace the project-specific import, resources, and background before use.
import { MainPage } from './MainPage'

@Entry
@Component
struct SplashPage {
  @State flag: boolean = false
  @State showMainPage: boolean = false
  private animationStarted: boolean = false

  onPageShow(): void {
    if (this.animationStarted) {
      return
    }
    this.animationStarted = true

    this.getUIContext().animateTo({
      duration: 1000,
      curve: Curve.EaseInOut,
      onFinish: () => {
        setTimeout(() => {
          this.showMainPage = true
        }, 200)
      }
    }, () => {
      this.flag = true
    })
  }

  build() {
    if (this.showMainPage) {
      MainPage()
    } else {
      Column() {
        if (this.flag) {
          Image($r('app.media.SPLASH_ICON'))
            .width(90)
            .height(90)
            .margin({ top: 120 })
            .transition(
              TransitionEffect.OPACITY.combine(TransitionEffect.translate({ x: -150 }))
            )

          Text($r('app.string.APP_NAME'))
            .fontSize(21)
            .fontColor('#263449')
            .fontWeight(FontWeight.Bold)
            .margin({ top: 15 })
            .transition(
              TransitionEffect.OPACITY.combine(TransitionEffect.translate({ x: 150 }))
            )
        }
        Blank()
        Text($r('app.string.SPLASH_FOOTER'))
          .fontSize(12)
          .fontColor('#A17E2D')
          .fontWeight(FontWeight.Bold)
          .margin({ bottom: 30 })
      }
      .width('100%')
      .height('100%')
      // Match this background to the target app's system start window.
      .backgroundColor('#FFFFFF')
    }
  }
}
