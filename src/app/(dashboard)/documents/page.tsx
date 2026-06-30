import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"

export default function DocumentsPage() {
  return (
    <div>
      <Header title="Belgeler" subtitle="Hasta belgeleri ve dosyaları" />
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium">Belge yönetimi yakında</p>
            <p className="text-sm text-muted-foreground">Bu bölüm geliştirme aşamasındadır</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
