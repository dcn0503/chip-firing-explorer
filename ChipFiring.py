class FGNode:
    """
    This class represents a complete graph with three vertices that is being used as a firing graph vertex.
    Each instance of FGNode has three vertices, labeled A, B, and C.

    Attributes
    ----------
    A : int
        number of chips on vertex A
    B : int
        number of chips on vertex B
    C : int
        number of chips on vertex C

    Methods
    -------
    total_chips(): returns int
        returns the total number of chips on the graph
    data(): returns tuple
        returns a tuple listing the number of chips on each vertex of the graph.
        for example, FGNode(1,2,3).data() == (1,2,3)
    copy(): returns FGNode
        returns another FGNode object with the same values of A, B, and C as the original graph
    fire(): returns dict
        returns a dictionary relating strings to FGNode objects. each key is a vertex label (type str),
        and each value is the new game state after firing that vertex (type FGNode). If a vertex has
        too few chips to fire, its entry is deleted from the dictionary.
    """

    def __init__(self, *chip_values):
        if type(chip_values[0]) == tuple:
            self.A, self.B, self.C = chip_values[0]
        else:
            self.A = chip_values[0]
            self.B = chip_values[1]
            self.C = chip_values[2]

    def __repr__(self):
        return f"FGNode({self.A}, {self.B}, {self.C})"

    def total_chips(self):
        n = self.A + self.B + self.C
        return n

    def data(self):
        data = (self.A, self.B, self.C)
        return data

    def copy(self):
        return type(self)(self.A, self.B, self.C)

    def fire(self):
        neighborA = type(self)(self.A - 2, self.B + 1, self.C + 1)
        neighborB = type(self)(self.A + 1, self.B - 2, self.C + 1)
        neighborC = type(self)(self.A + 1, self.B + 1, self.C - 2)
        neighbors = {"A": neighborA, "B": neighborB, "C": neighborC}
        for i in ["A", "B", "C"]:
            if any(n < 0 for n in neighbors[i].data()):
                del neighbors[i]
        return neighbors


def generate_FGNodes(n, v=3):
    """
    "Borrowed" from StackOverflow:
    https://stackoverflow.com/questions/7748442/generate-all-possible-lists-of-length-n-that-sum-to-s-in-python
    A function to generate all FGNodes in a firing graph.
    :param v: int
        number of vertices
    :param n: int
        number of chips
    :return: generator
        all possible ways to split n chips between v vertices
    """
    if v == 1:
        yield (n,)
    else:
        for value in range(n + 1):
            for permutation in generate_FGNodes(n - value, v - 1):
                yield (value,) + permutation


def make_firing_graph(n):
    """
    Creates the firing graph on K3 with n chips.
    :param n: int
        the total number of chips on K3. chips get moved around when vertices fire, but
        they're never created or destroyed.
    :return firing_graph: dict
        a dictionary representing a firing graph. keys are vertices, and values are dictionaries
        that give information about a vertex's out-edges.
    """
    firing_graph = {FGNode(line): [] for line in generate_FGNodes(n)}
    for v in firing_graph:
        firing_graph[v] = v.fire()
    return firing_graph
