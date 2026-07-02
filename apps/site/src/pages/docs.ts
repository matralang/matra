import { $m } from "../../modules/matra"
import defaultLayout from "../layouts/default-layout"

const pageDocs = defaultLayout($m`
  section.py-20 {
    div.max-w-3xl.mx-auto.px-6 {
      h1.text-4xl.font-bold.mb-6 { "ドキュメント" }
      p.text-lg.mb-4 {
        "MatraMagicの使用方法や機能についての詳細なドキュメントをご覧ください。"
        "初心者から上級者まで、すべてのユーザーに役立つ情報を提供します。"
      }
      ul.list-disc.pl-5.space-y-2 {
        li { "はじめに" }
        li { "チュートリアル" }
        li { "APIリファレンス" }
      }
    }
  }
`, {
  lang: "ja",
  title: "ドキュメント - MatraMagic",
  description: "MatraMagicの使用方法や機能についての詳細なドキュメントをご覧ください。"
})

export default pageDocs
