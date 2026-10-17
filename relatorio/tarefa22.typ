#import "@preview/ilm:2.1.1": *

#set text(lang: "pt")

#show: ilm.with(
  title: [Tarefa 2.2: Luz de spot],
  authors: "Luiz Felipe Neves Batista - 2311024",
)

= Introdução

Objetiva-se renderizar na tela uma cena conforme o modelo da Tarefa 2.2: uma mesa com um cubo amarelo e uma bola vermelha. Em cima do cubo amarelo, uma bola verde. Como atividade específica dessa tarefa, deve-se adicionar, em um lugar apropriado, uma luz de spot.
Foi escolhido TypeScript como a linguagem de programação. Foi utilizado como base o código do professor, que implementa o grafo de cena, e o código da Tarefa 2.1.

= Desenvolvimento

Foi criado um novo shader, `lit_spot.wgsl`, para tratar corretamente o uso da luz de spot, seguindo a lógica delineada no enunciado da tarefa, de forma a calcular e usar `k_spot`. Também foi adicionado um arquivo `spotlight.ts` para implementar a classe da luz de spot. Além das variáveis da pointlight, a spotlight possui light_direction, cone_angle e focus_exponent. O método `map` foi definido para que também transformasse e retornasse a light_direction, usando w=0 pois se trata de uma direção, a qual translações não devem afetar. Os atributos novos definidos na classe serão disponibilizados ao shader por meio do uniforme global.

A luz foi posicionada em um ângulo oblíquo, de forma a facilitar a percepção das sombras e as outras características da fonte de luz. Os valores do ângulo de abertura e expoente de concentração também foram escolhidos de forma adequada.

Após a implementação inicial do shader, percebeu-se que a silhueta da luz projetada na mesa possuía um formato estranho: uma espécie de folha, com descontinuidades em dois pontos ao longo da diagonal da mesa (uma elipse era esperada). Isso foi devido ao modo com que a direção da luz foi calculada no shader: por vértice, e não por pixel. Assim, ela precisava ser interpolada, o que não deu resultados precisos. Então, por fim, o shader foi alterado para que a direção da luz fosse calculada por pixel, no shader de fragmento, usando a posição interpolada do fragmento e a direção da luz. Assim, foi possível obter o formato de elipse na marca da luz.

= Links

Link do vídeo de demonstração do funcionamento: #link("https://drive.google.com/file/d/1XqPi-Q4u74ok1dcoTexR4IIJAz2250YN/view")
