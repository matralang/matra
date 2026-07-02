import { $m } from "../../modules/matra"
import defaultLayout from "../layouts/default-layout"

const pageContact = defaultLayout($m`
  section.py-20 {
    div.max-w-3xl.mx-auto.px-6 {
      h1.text-4xl.font-bold.mb-6 { "お問い合わせ" }
      p.text-lg.mb-4 {
        "MatraMagicに関するご質問やご意見がございましたら、お気軽にお問い合わせください。"
        "皆様からのフィードバックをお待ちしております。"
      }
      a.btn.px-5.py-3.bg-indigo-600.text-white.rounded-lg.font-semibold[
        href="mailto:butchiyu+matra@gmail.com"
      ] {
        "お問い合わせ（butchiyu+matra@gmail.com）"
      }
    }
  }
`, {
  lang: "ja",
  title: "お問い合わせ - MatraMagic",
  description: "MatraMagicへのお問い合わせ方法をご案内します。"
})

export default pageContact
