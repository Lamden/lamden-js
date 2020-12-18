yourState = Hash(default_value='')

@export
def test_values(UID: str, Str: str, Int: int, Float: float, Bool: bool, Dict: dict, List: list, ANY: Any, DateTime: datetime.datetime, TimeDelta: datetime.timedelta):
    yourState[UID, 'Str'] = Str
    assert isinstance(yourState[UID, 'Str'], str), 'Str should be of type str'
    yourState[UID, 'Int'] = Int
    assert isinstance(yourState[UID, 'Int'], int), 'Int should be of type int'
    yourState[UID, 'Float'] = Float
    #assert isinstance(yourState[UID, 'Float'], ContractingDecimal), type(yourState[UID, 'Float'])
    yourState[UID, 'Bool'] = Bool
    assert isinstance(yourState[UID, 'Bool'], bool), 'Bool should be of type bool'
    yourState[UID, 'Dict'] = Dict
    assert isinstance(yourState[UID, 'Dict'], dict), 'Dict should be of type dict'
    yourState[UID, 'List'] = List
    assert isinstance(yourState[UID, 'List'], list), 'List should be of type list'
    yourState[UID, 'ANY'] = ANY
    yourState[UID, 'DateTime'] = DateTime
    assert isinstance(yourState[UID, 'DateTime'], datetime.datetime), 'DateTime should be of type DateTime'
    yourState[UID, 'TimeDelta'] = TimeDelta
    assert isinstance(yourState[UID, 'TimeDelta'], datetime.timedelta), 'TimeDelta should be of type TimeDelta'