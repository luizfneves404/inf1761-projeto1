#import "@preview/ilm:2.1.1": *

#set text(lang: "pt")

#show: ilm.with(
  title: [Tarefa 2.1: Criação de cena 3D simples],
  authors: "Luiz Felipe Neves Batista - 2311024",
  abstract: [
    Trabalho de Computação Gráfica
  ],
)

= Introdução

Objetiva-se renderizar na tela uma cena conforme o modelo da Tarefa 2.1: uma mesa com um cubo amarelo e uma bola vermelha. Em cima do cubo amarelo, uma bola verde.
Foi escolhido TypeScript como a linguagem de programação. Foi utilizado como base o código do professor, que implementa o grafo de cena (nós, transformações, aparências, formas e motores de animação). A versão original estava em JavaScript e foi reescrita em TypeScript.
Foi tomado como base o arquivo main_3d e modificações foram feitas para que ficasse de acordo com o especificado na tarefa.

= Desenvolvimento

Adicionei algumas simples instanciações das formas usadas em main_3d. Cubos com escala para o tampo da mesa, os pés da mesa, e o cubo amarelo em cima da mesa. Esferas para as bolas verde e vermelha. Também elevei a fonte pontual de luz para que fique acima dos objetos e as coordenadas fossem dadas no espaço do mundo.

= Links

Link do vídeo de demonstração do funcionamento: #link("https://drive.google.com/file/d/1RasQdvEyzGiT_0jVYwWwU1L4TRV_xRm6/view?usp=sharing")
