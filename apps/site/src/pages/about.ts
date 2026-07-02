import { $m } from "../../modules/matra"
import defaultLayout from "../layouts/default-layout"

const pageAbout = defaultLayout($m`
  section.py-20 {
    div.max-w-3xl.mx-auto.px-6 {
      h1.text-4xl.font-bold.mb-6 { "MatraMagicについて" }
      p.text-lg.mb-4 {
        "MatraMagicは、クリエイティブなプロジェクトを支援するための多機能ツールです。"
        "テンプレート、エフェクト、コラボレーション機能を一つにまとめ、アイデアをすばやく形にします。"
      }
      h2.text-2xl.font-semibold.mt-8.mb-4 { "私たちのミッション" }
      p.text-lg.mb-4 {
        "私たちのミッションは、クリエイティブなプロセスをより効率的で楽しいものにすることです。"
        "MatraMagicを通じて、ユーザーが自分のビジョンを実現できるようサポートします。"
      }
      h2.text-2xl.font-semibold.mt-8.mb-4 { "チーム" }
      p.text-lg {
        "私たちは、多様なバックグラウンドを持つ情熱的な開発者とデザイナーのチームです。"
        "共通の目標に向かって協力し、最高の製品を提供することに専念しています。"
      }
    }
  }
`, {
  lang: "ja",
  title: "MatraMagicについて",
  description: "MatraMagicのミッションとチームについて紹介します。"
})

export default pageAbout
