import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';

@Component({
  selector: 'pros-floating-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-chat.component.html',
  styleUrls: ['./floating-chat.component.scss']
})
export class FloatingChatComponent {
  open = signal(false);

  toggle() {
    this.open.update(v => !v);
  }

  openSupport() {
    // Open support page in same tab
    window.open('/suporte', '_self');
  }

  openWhatsApp() {
    // Open WhatsApp chat with company number
    window.open('https://wa.me/5581989444164', '_blank');
  }
}
