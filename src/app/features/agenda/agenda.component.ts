import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface AgendaEvent {
  title: string;
  description: string;
  date: string;
  day: string;
  month: string;
  time: string;
  modality: 'online' | 'presencial';
}

@Component({
  selector: 'pros-agenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agenda.component.html',
  styleUrls: ['./agenda.component.scss']
})
export class AgendaComponent {

  readonly upcomingEvents: AgendaEvent[] = [
    {
      title: 'Workshop de liderança em SST',
      description: 'Capacitação intensiva para líderes que desejam consolidar culturas de segurança.',
      date: '2026-10-10',
      day: '10',
      month: 'Out',
      time: '14h – 16h',
      modality: 'online'
    },
    {
      title: 'Clínica de ergonomia aplicada',
      description: 'Sessão prática com análise de casos reais e ajustes por posto de trabalho.',
      date: '2026-10-22',
      day: '22',
      month: 'Out',
      time: '9h – 12h',
      modality: 'presencial'
    },
    {
      title: 'Série Onboarding sem fricção',
      description: 'Sequência de encontros semanais para estruturar trilhas de integração contínuas.',
      date: '2026-11-03',
      day: '03',
      month: 'Nov',
      time: '11h',
      modality: 'online'
    }
  ];

  filteredEvents() {
    return this.upcomingEvents;
  }
}
