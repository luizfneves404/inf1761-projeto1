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

Objetiva-se renderizar na tela um "sistema solar" composto por um Sol, a Terra e a Lua, utilizando WebGPU e uma estrutura de grafo de cena, conforme as instruções do enunciado.
Foi escolhido TypeScript como a linguagem de programação. Foi utilizado como base o código do professor, que implementa o grafo de cena (nós, transformações, aparências, formas e motores de animação). A versão original estava em JavaScript e foi reescrita em TypeScript.
O disco, utilizado como forma de todos os corpos celestes, e a montagem da cena do sistema solar foram implementados como parte deste trabalho.

= Desenvolvimento

A cena é organizada como uma árvore de nós, em que cada nó pode possuir uma transformação, aparências (como materiais), formas geométricas e nós filhos. No momento da renderização, cada nó compõe a sua matriz local com as matrizes de todos os seus ancestrais, de modo que transformar um nó afeta automaticamente toda a sua subárvore. Por isso, a Lua acompanha a Terra, e a Terra acompanha o Sol.

Para o disco, foi gerada uma malha de 60 triângulos dispostos em leque a partir do centro, formando um polígono que aproxima um círculo. A geometria é indexada: um buffer armazena as coordenadas dos vértices (acompanhadas de coordenadas de textura para uso futuro) e outro armazena os índices dos triângulos, que são desenhados com uma única chamada de desenho indexado.

A hierarquia da cena reflete o sistema solar. Na base, um nó raiz carrega apenas a pipeline; abaixo dele vem um nó de "posição do Sol", com uma transformação de translação para o centro do mundo. Então, foi necessário cuidado com os níveis intermediários da árvore: o Sol é um filho do nó de posição, contendo apenas a sua escala e o seu material. A Terra, porém, não pode ser filha direta do Sol: ela herdaria a escala do Sol, pois tudo que está acima na árvore afeta os descendentes. Por isso, a Terra foi colocada como irmã do Sol. A Terra também possui um nó próprio para a sua transformação de rotação (responsável pela translação ao redor do Sol) e, abaixo dele, um nó de "posição da Terra" com a translação que a afasta do centro (assim resolvemos o mesmo problema de antes, só que, agora, para a Lua). Somente então vem o nó da Terra em si, com escala e material próprios. A Lua segue o mesmo padrão em relação à Terra: um nó de rotação para a sua órbita, um nó de translação para afastá-la da Terra e, por último, o nó com escala e material (cinza). Assim, cada astro herda apenas os deslocamentos de seus ancestrais, e não as suas escalas, mantendo os tamanhos relativos corretos.

Como todas as translações e rotações atuam em níveis separados da árvore, basta que os motores de animação alterem as transformações de rotação da órbita da Terra e da Lua para que os planetas girem ao redor dos seus respectivos centros.

A animação é feita por meio de subclasses de `Engine` registradas na cena, que são atualizadas uma vez por quadro. Cada engine aplica uma rotação proporcional ao tempo decorrido desde o quadro anterior, fazendo com que a velocidade da animação seja independente da taxa de quadros. Assim, a Terra realiza o seu movimento de translação ao redor do Sol, enquanto a Lua realiza o seu movimento de rotação em torno da Terra em uma velocidade bem maior, aproximando o comportamento observado no sistema solar real.

= Vídeo

Link do vídeo de demonstração do funcionamento: #link("")
