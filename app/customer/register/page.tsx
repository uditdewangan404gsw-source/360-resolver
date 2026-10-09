import { redirect } from 'next/navigation'

export default function CustomerRegisterPage() {
  redirect('/?audience=customer&mode=sign-up')
}
