import { $m } from "../../modules/matra"
import defaultLayout from "../layouts/default-layout"

const pageProducts = defaultLayout($m`
  section.py-20 {
    div.max-w-3xl.mx-auto.px-6 {
      h1.text-4xl.font-bold.mb-6 { "製品一覧" }
      p.text-lg.mb-4 {
        "MatraMagicが提供する多彩な製品ラインナップをご紹介します。"
        "各製品はクリエイティブなプロセスをサポートし、効率化を図ります。"
      }
      ul.list-disc.pl-5.space-y-2 {
        li { "Matraテンプレートエンジン" }
        li { "リアルタイムコラボレーションツール" }
        li { "高度なエフェクトライブラリ" }
      }
    }
  }
`, {
  lang: "ja",
  title: "製品一覧 - MatraMagic",
  description: "MatraMagicが提供する製品ラインナップをご紹介します。"
})

export default pageProducts
