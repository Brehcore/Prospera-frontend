import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

@Component({
  selector: 'pros-faq',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss']
})
export class FaqComponent {
  expandedIndex = signal<number | null>(null);

  readonly faqItems: FaqItem[] = [
    // Acesso e Conteúdo
    {
      category: 'Acesso e Conteúdo',
      question: 'Como funciona o acesso aos cursos e materiais?',
      answer: 'Após adquirir um plano, você terá acesso imediato ao catálogo completo de treinamentos, e-books e cursos gravados. Acesse a seção "Cursos & Treinamentos" na sua conta para começar.'
    },
    {
      category: 'Acesso e Conteúdo',
      question: 'Posso acessar os materiais em qualquer dispositivo?',
      answer: 'Sim! Você pode acessar seus cursos em computadores, tablets e smartphones. Sincronizamos seu progresso automaticamente em todos os dispositivos.'
    },
    {
      category: 'Acesso e Conteúdo',
      question: 'Os treinamentos ao vivo podem ser assistidos depois?',
      answer: 'Sim. As sessões ao vivo são gravadas e disponibilizadas na sua area de "Cursos & Treinamentos" para que você revise sempre que precisar.'
    },
    {
      category: 'Acesso e Conteúdo',
      question: 'Os materiais são atualizados regularmente?',
      answer: 'Sim. Revisamos periodicamente com especialistas para refletir mudanças legais, melhores práticas e estudos recentes. Você terá acesso às versões mais atualizadas.'
    },

    // Planos e Pagamento
    {
      category: 'Planos e Pagamento',
      question: 'Qual plano devo escolher?',
      answer: 'Oferecemos planos para diferentes necessidades: Básico (para iniciação), Profissional (mais conteúdos) e Empresarial (acesso ilimitado com gestão de equipes). Compare na seção "Planos" ou entre em contato com nosso suporte.'
    },
    {
      category: 'Planos e Pagamento',
      question: 'Posso mudar de plano?',
      answer: 'Sim! Você pode fazer upgrade ou downgrade de plano a qualquer momento. Atualizaremos seu acesso imediatamente e ajustaremos a cobrança na próxima fatura.'
    },
    {
      category: 'Planos e Pagamento',
      question: 'Há política de reembolso?',
      answer: 'Você pode solicitar reembolso em até 7 dias corridos após a compra, conforme o Código de Defesa do Consumidor. Entre em contato com a Central de Suporte para processar.'
    },
    {
      category: 'Planos e Pagamento',
      question: 'Quais métodos de pagamento vocês aceitam?',
      answer: 'Aceitamos cartão de crédito, PIX e boleto bancário. Na seção "Métodos de Pagamento" da sua conta, você pode gerenciar suas formas de pagamento cadastradas.'
    },

    // Gestão Empresarial
    {
      category: 'Gestão Empresarial',
      question: 'Como adicionar minha empresa na plataforma?',
      answer: 'Na seção "Gerenciar Empresas" da sua conta, clique em "Adicionar Empresa" e preencha os dados. Você poderá vincular planos e gerenciar acessos de equipes.'
    },
    {
      category: 'Gestão Empresarial',
      question: 'Posso atribuir cursos para minha equipe?',
      answer: 'Sim! Com o plano Empresarial, você tem acesso à gestão de equipes. Atribua cursos e trilhas personalizadas para colaboradores e acompanhe o progresso em tempo real.'
    },
    {
      category: 'Gestão Empresarial',
      question: 'Como funciona o acesso de múltiplos usuários?',
      answer: 'Você pode convidar membros da sua equipe para a plataforma. Cada usuário tem seu próprio perfil e acompanhamento de progresso, controlado pela conta principal.'
    },

    // Segurança e Dados
    {
      category: 'Segurança e Dados',
      question: 'Meus dados são seguros?',
      answer: 'Sim. Utilizamos padrões de segurança de alto nível com criptografia. Pode alterar sua senha e gerenciar suas informações pessoais na seção "Dados Principais" da sua conta.'
    },
    {
      category: 'Segurança e Dados',
      question: 'Como altero meu e-mail ou senha?',
      answer: 'Na sua conta, acesse "Alterar E-mail" ou "Trocar Senha". Você receberá um código de verificação para confirmar as alterações com segurança.'
    },
    {
      category: 'Segurança e Dados',
      question: 'Posso deletar minha conta?',
      answer: 'Sim. Entre em contato com a Central de Suporte para solicitar a exclusão da sua conta. Seus dados serão removidos de acordo com nossas políticas de privacidade.'
    },

    // Suporte
    {
      category: 'Suporte',
      question: 'Como entro em contato com o suporte?',
      answer: 'Acesse a Central de Suporte através da seção "Suporte" no menu. Você pode abrir um chamado, enviar mensagens ou consultar artigos de ajuda.'
    },
    {
      category: 'Suporte',
      question: 'Qual é o tempo médio de resposta?',
      answer: 'Respondemos as solicitações em até 24 horas. Problemas críticos recebem atenção prioritária e são atendidos em poucas horas.'
    }
  ];

  toggleAccordion(index: number): void {
    this.expandedIndex.set(this.expandedIndex() === index ? null : index);
  }

  get categories(): string[] {
    return [...new Set(this.faqItems.map(item => item.category))];
  }

  getItemsByCategory(category: string): FaqItem[] {
    return this.faqItems.filter(item => item.category === category);
  }
}
