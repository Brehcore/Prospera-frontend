import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface AboutFeature {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'pros-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  readonly features: AboutFeature[] = [
    {
      icon: 'fa-shield-alt',
      title: 'Segurança',
      description: 'Especialistas em prevenção de acidentes e doenças ocupacionais com foco em conformidade.'
    },
    {
      icon: 'fa-heart',
      title: 'Saúde',
      description: 'Programas integrados de bem-estar e ergonomia para melhorar a qualidade de vida das equipes.'
    },
    {
      icon: 'fa-chart-line',
      title: 'Resultados',
      description: 'Metodologias comprovadas que geram impacto rápido e sustentável nas organizações.'
    }
  ];

  readonly team = [
    { name: 'Mariana Silva', role: 'Diretora de Conteúdo', photo: '/assets/images/team-marianas.jpg' },
    { name: 'Roberto Lima', role: 'Consultor SST', photo: '/assets/images/team-roberto.jpg' },
    { name: 'Ana Costa', role: 'Designer Instrucional', photo: '/assets/images/team-ana.jpg' },
    { name: 'Lucas Alves', role: 'Product Manager', photo: '/assets/images/team-lucas.jpg' }
  ];
}
