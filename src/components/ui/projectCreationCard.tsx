// components/StatsCard.tsx

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface StatsCardProps {
  title: string
  value: string
}

export default function StatsCard({
  title,
  value,
}: StatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent>
        {value}
      </CardContent>
    </Card>
  )
}