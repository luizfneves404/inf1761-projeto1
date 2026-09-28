#import "@preview/ilm:2.1.1": *

#set text(lang: "pt")

#show: ilm.with(
  title: [Projeto 1: Cena 2D com textura e animação],
  authors: "Luiz Felipe Neves Batista - 2311024",
  abstract: [
    Trabalho de Computação Gráfica
  ],
)

= Introdução

Objetiva-se renderizar na tela um "sistema solar" composto pelo Sol, Mercúrio, a Terra e a Lua, utilizando WebGPU e uma estrutura de grafo de cena, conforme as instruções do enunciado.
Foi escolhido TypeScript como a linguagem de programação. Foi utilizado como base o código do professor, que implementa o grafo de cena (nós, transformações, aparências, formas e motores de animação). A versão original estava em JavaScript e foi reescrita em TypeScript.
O disco, utilizado como forma de todos os corpos celestes, e a montagem básica da cena do sistema solar foram implementados como parte do trabalho anterior, a Tarefa 1.2. O presente trabalho constrói em cima disso, adicionando texturas, a rotação da Terra em torno de seu próprio eixo, Mercúrio e um pano de fundo representando o espaço.

= Desenvolvimento

A cena é organizada como uma árvore de nós, em que cada nó pode possuir uma transformação, aparências (como materiais), formas geométricas e nós filhos. No momento da renderização, cada nó compõe a sua matriz local com as matrizes de todos os seus ancestrais, de modo que transformar um nó afeta automaticamente toda a sua subárvore. Por isso, a Lua acompanha a Terra, e a Terra acompanha o Sol.

Para o disco, foi gerada uma malha de 60 triângulos dispostos em leque a partir do centro, formando um polígono que aproxima um círculo. A geometria é indexada: um buffer armazena as coordenadas dos vértices (acompanhadas de coordenadas de textura para uso futuro) e outro armazena os índices dos triângulos, que são desenhados com uma única chamada de desenho indexado.

A hierarquia da cena reflete o sistema solar. Na base, um nó raiz carrega apenas a pipeline; abaixo dele vem um nó de "posição do Sol", com uma transformação de translação para o centro do mundo. Então, foi necessário cuidado com os níveis intermediários da árvore: o Sol é um filho do nó de posição, contendo a sua escala. A Terra, porém, não pode ser filha direta do Sol: ela herdaria a escala do Sol, pois tudo que está acima na árvore afeta os descendentes. Por isso, a Terra foi colocada como irmã do Sol. A Terra também possui um nó próprio para a sua transformação de translação (responsável pela translação ao redor do Sol) e, abaixo dele, um nó de "posição da Terra" com a translação que a afasta do centro (assim resolvemos o mesmo problema de antes, só que, agora, para a Lua). Agora, como filho desse nó, colocamos o nó de rotação da Terra, o qual possui um `Transform` que é alterado para o movimento de rotação em torno do próprio eixo. Somente então vem o nó da Terra em si, com escala própria. A Lua, por sua vez, é colocada como filha do nó "posição da Terra", de forma que não herda o movimento de rotação da Terra. A Lua possui um nó de rotação para a sua órbita, um nó de translação para afastá-la da Terra e, por último, o nó com escala. Assim, cada astro herda apenas os deslocamentos de seus ancestrais, e não as suas escalas, mantendo os tamanhos relativos corretos.

Como todas as translações e rotações atuam em níveis separados da árvore, basta que os motores de animação alterem as transformações de rotação da órbita da Terra e da Lua para que girem ao redor do Sol e da Terra, respectivamente. Além disso, também há um motor de animação para a rotação da Terra ao redor de seu próprio eixo.

A animação é feita por meio de subclasses de `Engine` registradas na cena, que são atualizadas uma vez por quadro. Cada engine aplica uma rotação proporcional ao tempo decorrido desde o quadro anterior, fazendo com que a velocidade da animação seja independente da taxa de quadros. Assim, a Terra realiza o seu movimento de translação ao redor do Sol, enquanto a Lua realiza o seu movimento de rotação em torno da Terra em uma velocidade bem maior, aproximando o comportamento observado no sistema solar real.

Mercúrio foi colocado de forma muito similar à Terra, porém com menos nós aninhados, porque não existem corpos orbitando-o como no caso da Terra (o que não cria a necessidade de dividir a árvore em mais etapas). Um movimento de translação em torno do Sol foi adicionado.

Texturas foram adicionadas em todos os corpos celestes, o que fez com que mudanças no shader fossem necessárias. Alguns padrões do shader `textured.wgsl`, da cena 3D de exemplo, foram imitados nesse shader: o uso da estrutura VertexOutput e o tratamento da texcoord no shader de vértice e de fragmento. Como, na cor do fragmento, a cor do material está sendo multiplicada pela cor do texel na textura, foi necessário que todos os corpos celestes ganhassem um material de cor totalmente branca, para que a textura passe inalterada.

Para adicionar um pano de fundo representando o espaço, foi utilizado um nó, filho direto da raiz, contendo uma forma `Quad`. Foi adicionada uma textura nele e aplicada uma escala para que a textura cobrisse toda a tela. Como o nó foi adicionado antes do Sol no nó raiz, ele aparece no "fundo", por detrás de todos os corpos celestes.

= Links

Link do vídeo de demonstração do funcionamento: #link("https://drive.google.com/file/d/1Vqiez4ijx9-cMucOkJfXiCSelP3vXihZ/view?usp=sharing")
Link do repositório no GitHub com o código do projeto: #link("https://github.com/luizfneves404/inf1761-projeto1")
