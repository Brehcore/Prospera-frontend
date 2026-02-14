import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface PolicySection {
  title: string;
  paragraphs: string[];
}

@Component({
  selector: 'pros-policies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.scss']
})
export class PoliciesComponent {
  readonly sections: PolicySection[] = [
    {
      title: 'Política de Privacidade',
      paragraphs: [
        'Coletamos apenas os dados necessários para identificar usuários, processar transações e cumprir obrigações legais.',
        'Os dados são tratados com base em princípios de necessidade, transparência e segurança, seguindo a LGPD.',
        'Você pode solicitar a revisão, portabilidade ou exclusão dos dados. Envie um pedido para contato@gotreeconsultoria.com.br.'
      ]
    },
    {
      title: 'Termos de Uso',
      paragraphs: [
        'Ao acessar a plataforma, você concorda com o uso responsável dos conteúdos e com a manutenção dos acessos individuais.',
        'Os materiais são protegidos por direitos autorais. É proibida a reprodução ou distribuição sem autorização expressa.',
        'Reservamo-nos o direito de atualizar a plataforma e os valores, comunicando alterações relevantes com antecedência.'
      ]
    }
  ];
  print(): void {
    try { window.print(); } catch (e) { /* no-op in test environments */ }
  }

  isStaticSection(title: string): boolean {
    const t = (title || '').trim().toLowerCase();
    return t === 'política de privacidade' || t === 'termos de uso' || t === 'politica de privacidade';
  }
}
